from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from sklearn.neighbors import NearestNeighbors

FEATURE_ORDER = [
    "vision_loss", "color_blindness",
    "delayed_reaction", "inaccurate_click", "motor_impairment",
    "literacy"
]

@dataclass
class KNNArtifacts:
    nn: NearestNeighbors
    X: np.ndarray                 # shape (n_samples, 6)
    profiles: list[dict]          # length n_samples, knob dicts
    feature_order: list[str] = None
    n_samples: int = 0
    metric: str = "cosine"
    distance_scale: float = 1.0
    train_neighbor_distance_mean: float | None = None
    train_neighbor_distance_std: float | None = None


def build_query_vector(impairment_probs: dict) -> np.ndarray:
    # impairment_probs is flattened dict with 6 keys
    return np.array([float(impairment_probs[k]) for k in FEATURE_ORDER], dtype=float)


def train_knn(X: np.ndarray, profiles: list[dict], k: int = 10, metric: str = "cosine") -> KNNArtifacts:
    nn = NearestNeighbors(n_neighbors=min(k, len(X)), metric=metric)
    nn.fit(X)
    if metric == "euclidean":
        distance_scale = float(np.sqrt(X.shape[1]))
    else:
        distance_scale = 1.0

    calibration_mean = 0.0
    calibration_std = 0.0
    if len(X) > 1:
        calibration_nn = NearestNeighbors(n_neighbors=min(k + 1, len(X)), metric=metric)
        calibration_nn.fit(X)
        train_dists, _ = calibration_nn.kneighbors(X)
        # Drop the self-match at distance 0 and summarize each point's neighborhood density.
        local_neighbor_dists = train_dists[:, 1:]
        local_avg_dists = np.mean(local_neighbor_dists, axis=1)
        calibration_mean = float(np.mean(local_avg_dists))
        calibration_std = float(np.std(local_avg_dists))

    return KNNArtifacts(
        nn=nn,
        X=X,
        profiles=profiles,
        feature_order=FEATURE_ORDER,
        n_samples=len(X),
        metric=metric,
        distance_scale=distance_scale,
        train_neighbor_distance_mean=calibration_mean,
        train_neighbor_distance_std=calibration_std,
    )
