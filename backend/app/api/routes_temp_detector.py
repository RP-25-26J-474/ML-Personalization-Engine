from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np

from app.api.wiring import container
from app.core.schemas.interactions import InteractionBatch

router = APIRouter()


class TempScoreResponse(BaseModel):
    user_id: str
    batch_id: str
    quarantined: bool
    rejected: bool
    outcome: str
    anomaly_score: float
    similarity_score: float
    reason: str | None
    trace: dict


@router.post("/score-batch", response_model=TempScoreResponse)
def score_batch(batch: InteractionBatch):
    res = container.temp_detector.score_batch(batch)
    return TempScoreResponse(
        user_id=batch.user_id,
        batch_id=batch.batch_id,
        quarantined=res.is_quarantined,
        rejected=res.is_rejected,
        outcome=res.outcome,
        anomaly_score=res.anomaly_score,
        similarity_score=res.similarity_score,
        reason=res.reason,
        trace=res.trace.model_dump(),
    )


class TrainGlobalRequest(BaseModel):
    # For demo: accept feature vectors directly
    feature_matrix: list[list[float]]


class TempScoreItem(BaseModel):
    user_id: str
    batch_id: str
    outcome: str
    quarantined: bool
    rejected: bool
    anomaly_score: float
    similarity_score: float
    reason: str | None
    trace: dict
    batch: dict


class TempScoreBatchesRequest(BaseModel):
    batches: list[InteractionBatch]


class TempScoreBatchesResponse(BaseModel):
    summary: dict
    kept: list[TempScoreItem]
    quarantined: list[TempScoreItem]
    rejected: list[TempScoreItem]


@router.post("/score-batches", response_model=TempScoreBatchesResponse)
def score_batches(req: TempScoreBatchesRequest):
    results = container.temp_detector.score_batches(req.batches)
    kept: list[TempScoreItem] = []
    quarantined: list[TempScoreItem] = []
    rejected: list[TempScoreItem] = []

    for batch, res in zip(req.batches, results):
        item = TempScoreItem(
            user_id=batch.user_id,
            batch_id=batch.batch_id,
            outcome=res.outcome,
            quarantined=res.is_quarantined,
            rejected=res.is_rejected,
            anomaly_score=res.anomaly_score,
            similarity_score=res.similarity_score,
            reason=res.reason,
            trace=res.trace.model_dump(),
            batch=batch.model_dump(),
        )
        if res.outcome == "keep":
            kept.append(item)
        elif res.outcome == "reject":
            rejected.append(item)
        else:
            quarantined.append(item)

    summary = {
        "total": len(req.batches),
        "kept": len(kept),
        "quarantined": len(quarantined),
        "rejected": len(rejected),
    }

    return TempScoreBatchesResponse(
        summary=summary,
        kept=kept,
        quarantined=quarantined,
        rejected=rejected,
    )


@router.post("/train-global")
def train_global(req: TrainGlobalRequest):
    X = np.array(req.feature_matrix, dtype=float)
    container.temp_detector.train_global(X)
    container.models_repo.global_iforest_version = "v1"
    return {"status": "trained", "n_samples": int(X.shape[0]), "version": "v1"}
