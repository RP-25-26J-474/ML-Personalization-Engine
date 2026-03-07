from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from app.core.schemas.interactions import InteractionBatch
from app.core.storage.artifact_registry.artifact_store import ArtifactStore
from app.core.engine.user_engine import rules
import torch
from torch import nn


FEATURE_ORDER = [
    "click_count",
    "misclick_rate",
    "avg_click_interval_ms",
    "avg_dwell_ms",
    "rage_clicks",
    "zoom_events",
    "scroll_speed_px_s",
]

MODEL_KEY = "user_engine/seq_ae_model"


@dataclass
class SeqModelBundle:
    model: Any
    scaler: StandardScaler
    kmeans: KMeans
    cluster_templates: dict[int, dict[str, Any]]
    cluster_max_dist: dict[int, float]
    config: dict[str, Any]


class SequenceAutoencoder(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int):
        super().__init__()
        self.encoder = nn.GRU(input_dim, hidden_dim, batch_first=True)
        self.decoder = nn.GRU(hidden_dim, hidden_dim, batch_first=True)
        self.output = nn.Linear(hidden_dim, input_dim)

    def encode(self, x: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        lengths = lengths.cpu()
        packed = torch.nn.utils.rnn.pack_padded_sequence(
            x, lengths, batch_first=True, enforce_sorted=False
        )
        _, h = self.encoder(packed)
        return h[-1]

    def forward(self, x: torch.Tensor, lengths: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        z = self.encode(x, lengths)
        max_len = x.size(1)
        repeated = z.unsqueeze(1).repeat(1, max_len, 1)
        decoded, _ = self.decoder(repeated)
        recon = self.output(decoded)
        return recon, z


def extract_feature_vector(batch: InteractionBatch) -> np.ndarray:
    e = batch.events_agg
    return np.array(
        [
            float(e.click_count),
            float(e.misclick_rate),
            float(e.avg_click_interval_ms),
            float(e.avg_dwell_ms),
            float(e.rage_clicks),
            float(e.zoom_events),
            float(e.scroll_speed_px_s),
        ],
        dtype=float,
    )


def parse_timestamp(value: str) -> datetime:
    try:
        if value.endswith("Z"):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.fromisoformat(value)
    except ValueError:
        return datetime.now(timezone.utc)


def _ensure_torch() -> None:
    if torch is None or nn is None:
        raise RuntimeError("torch is required for the sequence autoencoder")


def _pad_sequences(sequences: list[np.ndarray], max_len: int) -> tuple[np.ndarray, np.ndarray]:
    lengths = np.array([min(len(seq), max_len) for seq in sequences], dtype=np.int64)
    feat_dim = sequences[0].shape[1]
    padded = np.zeros((len(sequences), max_len, feat_dim), dtype=np.float32)
    for idx, seq in enumerate(sequences):
        use_len = min(len(seq), max_len)
        padded[idx, :use_len, :] = seq[:use_len]
    return padded, lengths


def _sequence_aggregate(features: np.ndarray) -> dict[str, float]:
    click_counts = np.maximum(1.0, features[:, 0])

    def wavg(col_idx: int) -> float:
        return float(np.sum(features[:, col_idx] * click_counts) / np.sum(click_counts))

    return {
        "click_count": float(np.sum(features[:, 0])),
        "misclick_rate": wavg(1),
        "avg_click_interval_ms": wavg(2),
        "avg_dwell_ms": wavg(3),
        "rage_clicks": float(np.sum(features[:, 4])),
        "zoom_events": float(np.sum(features[:, 5])),
        "scroll_speed_px_s": wavg(6),
    }


def _template_from_agg(agg: dict[str, float]) -> dict[str, Any]:
    return rules.suggest_from_agg(agg)


def train_seq_model(
    sequences: list[np.ndarray],
    max_len: int = 20,
    embedding_dim: int = 16,
    n_clusters: int | None = None,
    epochs: int = 30,
    learning_rate: float = 1e-3,
    batch_size: int = 16,
    seed: int = 42,
) -> SeqModelBundle:
    _ensure_torch()

    rng = np.random.default_rng(seed)
    input_dim = sequences[0].shape[1]

    scaler = StandardScaler()
    stacked = np.vstack(sequences)
    scaler.fit(stacked)
    scaled_sequences = [scaler.transform(seq) for seq in sequences]

    padded, lengths = _pad_sequences(scaled_sequences, max_len)

    device = torch.device("cpu")
    model = SequenceAutoencoder(input_dim=input_dim, hidden_dim=embedding_dim).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    indices = np.arange(len(padded))
    for _ in range(epochs):
        rng.shuffle(indices)
        for start in range(0, len(indices), batch_size):
            batch_idx = indices[start : start + batch_size]
            x = torch.tensor(padded[batch_idx], dtype=torch.float32, device=device)
            lens = torch.tensor(lengths[batch_idx], dtype=torch.long, device=device)
            recon, _ = model(x, lens)

            mask = (torch.arange(x.size(1), device=device)[None, :] < lens[:, None]).float()
            mask = mask.unsqueeze(-1)
            loss = ((recon - x) ** 2 * mask).sum() / mask.sum().clamp_min(1.0)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

    model.eval()
    with torch.no_grad():
        all_x = torch.tensor(padded, dtype=torch.float32, device=device)
        all_lens = torch.tensor(lengths, dtype=torch.long, device=device)
        embeddings = model.encode(all_x, all_lens).cpu().numpy().astype(np.float64, copy=False)

    if n_clusters is None:
        n_clusters = max(1, min(6, int(np.sqrt(len(embeddings)) or 1)))
    n_clusters = min(n_clusters, len(embeddings))
    kmeans = KMeans(n_clusters=n_clusters, random_state=seed, n_init="auto")
    labels = kmeans.fit_predict(embeddings)

    cluster_max_dist: dict[int, float] = {}
    for idx, center in enumerate(kmeans.cluster_centers_):
        dists = np.linalg.norm(embeddings[labels == idx] - center, axis=1)
        cluster_max_dist[idx] = float(np.max(dists)) if len(dists) else 1.0

    cluster_templates: dict[int, dict[str, Any]] = {}
    for cluster_id in range(n_clusters):
        seq_indices = np.where(labels == cluster_id)[0]
        if len(seq_indices) == 0:
            cluster_templates[cluster_id] = {}
            continue

        agg_values = []
        weights = []
        for seq_idx in seq_indices:
            raw_seq = sequences[seq_idx]
            agg = _sequence_aggregate(raw_seq)
            agg_values.append(agg)
            weights.append(max(1.0, agg["click_count"]))

        weight_sum = float(np.sum(weights))
        merged = {}
        for key in agg_values[0].keys():
            merged[key] = float(
                np.sum([val[key] * w for val, w in zip(agg_values, weights)]) / weight_sum
            )

        cluster_templates[cluster_id] = _template_from_agg(merged)

    config = {
        "feature_order": list(FEATURE_ORDER),
        "max_len": max_len,
        "embedding_dim": embedding_dim,
        "n_clusters": n_clusters,
    }

    return SeqModelBundle(
        model=model,
        scaler=scaler,
        kmeans=kmeans,
        cluster_templates=cluster_templates,
        cluster_max_dist=cluster_max_dist,
        config=config,
    )


def save_bundle(bundle: SeqModelBundle, store: ArtifactStore) -> str:
    payload = {
        "state_dict": bundle.model.state_dict(),
        "scaler": bundle.scaler,
        "kmeans": bundle.kmeans,
        "cluster_templates": bundle.cluster_templates,
        "cluster_max_dist": bundle.cluster_max_dist,
        "config": bundle.config,
    }
    return store.save(MODEL_KEY, payload)


def load_bundle(store: ArtifactStore) -> SeqModelBundle | None:
    _ensure_torch()
    payload = store.load(MODEL_KEY)
    if payload is None:
        return None

    config = payload["config"]
    model = SequenceAutoencoder(
        input_dim=len(config.get("feature_order", FEATURE_ORDER)),
        hidden_dim=config["embedding_dim"],
    )
    model.load_state_dict(payload["state_dict"])
    model.eval()
    return SeqModelBundle(
        model=model,
        scaler=payload["scaler"],
        kmeans=payload["kmeans"],
        cluster_templates=payload["cluster_templates"],
        cluster_max_dist=payload["cluster_max_dist"],
        config=config,
    )


def infer_cluster(
    bundle: SeqModelBundle,
    sequence: np.ndarray,
) -> tuple[int, float, float]:
    _ensure_torch()
    max_len = bundle.config.get("max_len", 20)
    scaled = bundle.scaler.transform(sequence)
    padded, lengths = _pad_sequences([scaled], max_len)

    device = torch.device("cpu")
    x = torch.tensor(padded, dtype=torch.float32, device=device)
    lens = torch.tensor(lengths, dtype=torch.long, device=device)

    bundle.model.eval()
    with torch.no_grad():
        embedding = bundle.model.encode(x, lens).cpu().numpy()[0]

    # Keep dtype aligned with persisted KMeans internals (legacy bundles may be float32).
    kmeans_dtype = getattr(bundle.kmeans.cluster_centers_, "dtype", np.float64)
    predict_x = np.asarray(embedding, dtype=kmeans_dtype, order="C").reshape(1, -1)

    cluster_id = int(bundle.kmeans.predict(predict_x)[0])
    center = bundle.kmeans.cluster_centers_[cluster_id]
    dist = float(np.linalg.norm(embedding - center))
    max_dist = max(1e-6, float(bundle.cluster_max_dist.get(cluster_id, 1.0)))
    similarity = max(0.0, 1.0 - min(1.0, dist / max_dist))
    return cluster_id, dist, similarity


def encode_sequences(bundle: SeqModelBundle, sequences: list[np.ndarray]) -> np.ndarray:
    _ensure_torch()
    if not sequences:
        return np.zeros((0, 0), dtype=np.float64)

    max_len = int(bundle.config.get("max_len", 20))
    scaled = [bundle.scaler.transform(sequence) for sequence in sequences]
    padded, lengths = _pad_sequences(scaled, max_len)

    device = torch.device("cpu")
    x = torch.tensor(padded, dtype=torch.float32, device=device)
    lens = torch.tensor(lengths, dtype=torch.long, device=device)

    bundle.model.eval()
    with torch.no_grad():
        embeddings = bundle.model.encode(x, lens).cpu().numpy()

    return embeddings.astype(np.float64, copy=False)
