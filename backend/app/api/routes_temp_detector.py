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
    anomaly_score: float
    reason: str | None
    trace: dict


@router.post("/score-batch", response_model=TempScoreResponse)
def score_batch(batch: InteractionBatch):
    res = container.temp_detector.score_batch(batch)
    return TempScoreResponse(
        user_id=batch.user_id,
        batch_id=batch.batch_id,
        quarantined=res.is_quarantined,
        anomaly_score=res.anomaly_score,
        reason=res.reason,
        trace=res.trace.model_dump(),
    )


class TrainGlobalRequest(BaseModel):
    # For demo: accept feature vectors directly
    feature_matrix: list[list[float]]


@router.post("/train-global")
def train_global(req: TrainGlobalRequest):
    X = np.array(req.feature_matrix, dtype=float)
    container.temp_detector.train_global(X)
    container.models_repo.global_iforest_version = "v1"
    return {"status": "trained", "n_samples": int(X.shape[0]), "version": "v1"}
