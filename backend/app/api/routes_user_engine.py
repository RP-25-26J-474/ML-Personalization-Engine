from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import numpy as np
from importlib import import_module

from app.api.wiring import container
from app.core.schemas.interactions import InteractionBatch, InteractionBatchList
from app.core.utils.time import now_iso

router = APIRouter()


def _seq_autoencoder():
    return import_module("app.core.engine.user_engine.seq_autoencoder")


class UserUpdateResponse(BaseModel):
    quarantined: bool
    anomaly_score: float | None = None
    profile: dict | None = None
    diff: dict | None = None
    traces: list[dict]


class UserUpdateBatchResponse(BaseModel):
    quarantined: bool
    profile: dict | None = None
    diff: dict | None = None
    traces: list[dict]
    kept_batches: list[str]
    quarantined_batches: list[dict]
    rejected_batches: list[dict]


class TrainSeqModelRequest(BaseModel):
    outcomes: list[str] = Field(
        default_factory=lambda: ["keep"],
        description="Outcome labels included when building training sequences.",
    )
    min_users: int = Field(default=5, description="Minimum users required to start sequence training.")
    min_sequences: int = Field(default=20, description="Minimum sequence count required to train.")
    min_sequence_len: int = Field(default=2, description="Minimum batches per user sequence.")
    max_sequence_len: int = Field(default=20, description="Maximum batches retained per user sequence.")
    embedding_dim: int = Field(default=16, description="Latent embedding size for sequence encoder.")
    n_clusters: int | None = Field(default=None, description="Optional explicit KMeans cluster count.")
    epochs: int = Field(default=30, description="Training epochs for the autoencoder.")
    learning_rate: float = Field(default=1e-3, description="Optimizer learning rate.")
    batch_size: int = Field(default=16, description="Mini-batch size used in sequence model training.")
    seed: int = Field(default=42, description="Random seed for reproducible training.")


class TrainSeqModelResponse(BaseModel):
    status: str
    n_users: int
    n_sequences: int
    n_clusters: int | None = None
    model_version: str | None = None


class UserClusterPoint(BaseModel):
    user_id: str
    sequence_len: int
    cluster_id: int
    distance: float
    similarity: float
    coords: list[float] = Field(min_length=2, max_length=2)


class UserClusterSummary(BaseModel):
    cluster_id: int
    count: int
    avg_similarity: float


class UserClusterMapResponse(BaseModel):
    status: str
    model_version: str
    n_points: int
    n_clusters: int
    outcome_filter: list[str]
    points: list[UserClusterPoint]
    clusters: list[UserClusterSummary]


@router.post(
    "/update-profile",
    response_model=UserUpdateResponse,
    summary="Update profile from one batch",
    description=(
        "Processes one interaction batch through temp-detector gating and user personalization updates."
    ),
)
def update_profile(batch: InteractionBatch):
    out = container.orchestrator.handle_interactions(batch)
    return UserUpdateResponse(
        quarantined=out.quarantined,
        anomaly_score=out.anomaly_score,
        profile=out.profile.model_dump() if out.profile else None,
        diff=out.diff.model_dump() if out.diff else None,
        traces=[t.model_dump() for t in out.traces.traces],
    )


@router.post(
    "/update-profile-batch",
    response_model=UserUpdateBatchResponse,
    summary="Update profile from many batches",
    description="Processes a same-user batch list and returns merged profile updates and gating outcomes.",
)
def update_profile_batch(payload: InteractionBatchList):
    batches = payload.batches
    if not batches:
        raise HTTPException(status_code=400, detail="batches must not be empty")

    user_ids = {b.user_id for b in batches}
    if len(user_ids) != 1:
        raise HTTPException(status_code=400, detail="all batches must have same user_id")

    out = container.orchestrator.handle_interactions_many(batches)
    return UserUpdateBatchResponse(
        quarantined=out.quarantined,
        profile=out.profile.model_dump() if out.profile else None,
        diff=out.diff.model_dump() if out.diff else None,
        traces=[t.model_dump() for t in out.traces.traces],
        kept_batches=out.kept_batches,
        quarantined_batches=out.quarantined_batches,
        rejected_batches=out.rejected_batches,
    )


@router.post(
    "/train-seq-model",
    response_model=TrainSeqModelResponse,
    summary="Train user sequence model",
    description="Trains the GRU autoencoder + clustering bundle used for user behavior sequence personalization.",
)
def train_seq_model(req: TrainSeqModelRequest):
    seq_autoencoder = _seq_autoencoder()
    rows = container.temp_batches_repo.list_all()
    if req.outcomes:
        rows = [row for row in rows if row.outcome in set(req.outcomes)]

    users: dict[str, list] = {}
    for row in rows:
        users.setdefault(row.user_id, []).append(row)

    sequences = []
    for user_rows in users.values():
        ordered = sorted(
            user_rows,
            key=lambda r: seq_autoencoder.parse_timestamp(r.captured_at),
        )
        batches = [InteractionBatch(**r.payload) for r in ordered]
        if len(batches) >= req.min_sequence_len:
            sequences.append(batches[-req.max_sequence_len :])

    user_count = len(sequences)
    if user_count < req.min_users or len(sequences) < req.min_sequences:
        return TrainSeqModelResponse(
            status="not_enough_samples",
            n_users=user_count,
            n_sequences=len(sequences),
            n_clusters=None,
            model_version=None,
        )

    vectors = [
        np.stack([seq_autoencoder.extract_feature_vector(b) for b in seq], axis=0)
        for seq in sequences
    ]
    train_stats = container.user_engine.train_seq_model(
        sequences=vectors,
        max_len=req.max_sequence_len,
        embedding_dim=req.embedding_dim,
        n_clusters=req.n_clusters,
        epochs=req.epochs,
        learning_rate=req.learning_rate,
        batch_size=req.batch_size,
        seed=req.seed,
    )

    trained_at = now_iso()
    version = f"v{trained_at}"
    container.models_repo.user_seq_model_version = version
    container.models_repo.user_seq_n_clusters = train_stats["n_clusters"]
    container.models_repo.user_seq_embedding_dim = req.embedding_dim
    container.models_repo.user_seq_last_trained_at = trained_at

    return TrainSeqModelResponse(
        status="trained",
        n_users=user_count,
        n_sequences=train_stats["n_sequences"],
        n_clusters=train_stats["n_clusters"],
        model_version=version,
    )


def _project_to_2d(embeddings: np.ndarray) -> np.ndarray:
    if embeddings.shape[0] == 0:
        return np.zeros((0, 2), dtype=np.float64)
    if embeddings.shape[0] == 1:
        return np.zeros((1, 2), dtype=np.float64)

    centered = embeddings - np.mean(embeddings, axis=0, keepdims=True)
    _, _, vh = np.linalg.svd(centered, full_matrices=False)
    components = vh[:2].T
    projected = centered @ components
    if projected.shape[1] == 1:
        projected = np.hstack([projected, np.zeros((projected.shape[0], 1), dtype=np.float64)])
    return projected[:, :2]


@router.get(
    "/cluster-map",
    response_model=UserClusterMapResponse,
    summary="Get user cluster map",
    description="Returns 2D projected user embeddings, predicted clusters, and cluster-level summary metrics.",
)
def user_cluster_map(
    outcomes: list[str] = Query(default=[]),
    min_sequence_len: int = 2,
    max_sequence_len: int = 20,
):
    seq_autoencoder = _seq_autoencoder()
    bundle = container.user_engine._seq_bundle
    model_version = container.models_repo.user_seq_model_version
    if bundle is None:
        return UserClusterMapResponse(
            status="untrained",
            model_version=model_version,
            n_points=0,
            n_clusters=0,
            outcome_filter=list(outcomes),
            points=[],
            clusters=[],
        )

    rows = container.temp_batches_repo.list_all()
    if outcomes:
        allowed = set(outcomes)
        rows = [row for row in rows if row.outcome in allowed]

    users: dict[str, list] = {}
    for row in rows:
        users.setdefault(row.user_id, []).append(row)

    user_ids: list[str] = []
    sequences: list[np.ndarray] = []
    sequence_lens: list[int] = []
    for user_id, user_rows in users.items():
        ordered = sorted(
            user_rows,
            key=lambda r: seq_autoencoder.parse_timestamp(r.captured_at),
        )
        batches = [InteractionBatch(**r.payload) for r in ordered]
        if len(batches) < min_sequence_len:
            continue
        selected = batches[-max_sequence_len:]
        user_ids.append(user_id)
        sequence_lens.append(len(selected))
        sequences.append(
            np.stack([seq_autoencoder.extract_feature_vector(b) for b in selected], axis=0)
        )

    if not sequences:
        return UserClusterMapResponse(
            status="no_sequences",
            model_version=model_version,
            n_points=0,
            n_clusters=int(bundle.config.get("n_clusters", 0)),
            outcome_filter=list(outcomes),
            points=[],
            clusters=[],
        )

    embeddings = seq_autoencoder.encode_sequences(bundle, sequences)
    projected = _project_to_2d(embeddings)
    kmeans_dtype = getattr(bundle.kmeans.cluster_centers_, "dtype", np.float64)
    predicted = bundle.kmeans.predict(
        np.asarray(embeddings, dtype=kmeans_dtype, order="C")
    )

    points: list[UserClusterPoint] = []
    cluster_sims: dict[int, list[float]] = {}
    for idx, cluster_id in enumerate(predicted):
        center = bundle.kmeans.cluster_centers_[cluster_id]
        dist = float(np.linalg.norm(embeddings[idx] - center))
        max_dist = max(1e-6, float(bundle.cluster_max_dist.get(int(cluster_id), 1.0)))
        similarity = max(0.0, 1.0 - min(1.0, dist / max_dist))
        cluster_sims.setdefault(int(cluster_id), []).append(similarity)
        points.append(
            UserClusterPoint(
                user_id=user_ids[idx],
                sequence_len=sequence_lens[idx],
                cluster_id=int(cluster_id),
                distance=dist,
                similarity=float(similarity),
                coords=[float(projected[idx, 0]), float(projected[idx, 1])],
            )
        )

    clusters = [
        UserClusterSummary(
            cluster_id=cluster_id,
            count=len(similarities),
            avg_similarity=float(np.mean(similarities)),
        )
        for cluster_id, similarities in sorted(cluster_sims.items(), key=lambda item: item[0])
    ]

    return UserClusterMapResponse(
        status="ready",
        model_version=model_version,
        n_points=len(points),
        n_clusters=int(bundle.config.get("n_clusters", len(clusters))),
        outcome_filter=list(outcomes),
        points=points,
        clusters=clusters,
    )
