from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import numpy as np

from app.api.wiring import container
from app.core.schemas.interactions import InteractionBatch, InteractionBatchList
from app.core.engine.user_engine import seq_autoencoder
from app.core.utils.time import now_iso

router = APIRouter()


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
    outcomes: list[str] = Field(default_factory=lambda: ["keep"])
    min_users: int = 5
    min_sequences: int = 20
    min_sequence_len: int = 2
    max_sequence_len: int = 20
    embedding_dim: int = 16
    n_clusters: int | None = None
    epochs: int = 30
    learning_rate: float = 1e-3
    batch_size: int = 16
    seed: int = 42


class TrainSeqModelResponse(BaseModel):
    status: str
    n_users: int
    n_sequences: int
    n_clusters: int | None = None
    model_version: str | None = None


@router.post("/update-profile", response_model=UserUpdateResponse)
def update_profile(batch: InteractionBatch):
    out = container.orchestrator.handle_interactions(batch)
    return UserUpdateResponse(
        quarantined=out.quarantined,
        anomaly_score=out.anomaly_score,
        profile=out.profile.model_dump() if out.profile else None,
        diff=out.diff.model_dump() if out.diff else None,
        traces=[t.model_dump() for t in out.traces.traces],
    )


@router.post("/update-profile-batch", response_model=UserUpdateBatchResponse)
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


@router.post("/train-seq-model", response_model=TrainSeqModelResponse)
def train_seq_model(req: TrainSeqModelRequest):
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
