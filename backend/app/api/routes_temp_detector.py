from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
import numpy as np

from app.api.wiring import container
from app.core.schemas.interactions import InteractionBatch
from app.core.storage.repos.temp_batches_repo import TempBatchRecord
from app.core.utils.time import now_iso

router = APIRouter()


class TempScoreResponse(BaseModel):
    user_id: str
    batch_id: str
    quarantined: bool
    rejected: bool
    outcome: str
    anomaly_score: float
    similarity_score: float
    heuristic_components: dict
    reason: str | None
    trace: dict


@router.post("/score-batch", response_model=TempScoreResponse)
def score_batch(batch: InteractionBatch):
    res = container.temp_detector.score_batch(batch)
    container.temp_batches_repo.add(
        TempBatchRecord(
            user_id=batch.user_id,
            batch_id=batch.batch_id,
            captured_at=batch.captured_at,
            outcome=res.outcome,
            anomaly_score=res.anomaly_score,
            similarity_score=res.similarity_score,
            heuristic_components=res.heuristic_components,
            features=res.features,
            payload=batch.model_dump(),
        )
    )
    if res.outcome == "keep":
        container.temp_detector.update_baseline(batch.user_id, res.features)
    return TempScoreResponse(
        user_id=batch.user_id,
        batch_id=batch.batch_id,
        quarantined=res.is_quarantined,
        rejected=res.is_rejected,
        outcome=res.outcome,
        anomaly_score=res.anomaly_score,
        similarity_score=res.similarity_score,
        heuristic_components=res.heuristic_components,
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
    heuristic_components: dict
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
        container.temp_batches_repo.add(
            TempBatchRecord(
                user_id=batch.user_id,
                batch_id=batch.batch_id,
                captured_at=batch.captured_at,
                outcome=res.outcome,
                anomaly_score=res.anomaly_score,
                similarity_score=res.similarity_score,
                heuristic_components=res.heuristic_components,
                features=res.features,
                payload=batch.model_dump(),
            )
        )
        if res.outcome == "keep":
            container.temp_detector.update_baseline(batch.user_id, res.features)

        item = TempScoreItem(
            user_id=batch.user_id,
            batch_id=batch.batch_id,
            outcome=res.outcome,
            quarantined=res.is_quarantined,
            rejected=res.is_rejected,
            anomaly_score=res.anomaly_score,
            similarity_score=res.similarity_score,
            heuristic_components=res.heuristic_components,
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
        "quarantine_threshold": container.temp_detector.quarantine_threshold,
        "reject_threshold": container.temp_detector.reject_threshold,
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
    version = f"v{now_iso()}"
    container.models_repo.global_iforest_version = version
    return {"status": "trained", "n_samples": int(X.shape[0]), "version": version}


class TrainFromSynthRequest(BaseModel):
    n_samples: int = 400
    seed: int = 42


@router.post("/train-synth")
def train_synth(req: TrainFromSynthRequest):
    n_samples = container.temp_detector.train_from_synth(n=req.n_samples, seed=req.seed)
    version = f"v{now_iso()}"
    container.models_repo.global_iforest_version = version
    return {"status": "trained", "n_samples": n_samples, "version": version}


class TrainFromBatchesRequest(BaseModel):
    user_id: str | None = None
    outcomes: list[str] = Field(default_factory=lambda: ["keep"])
    min_samples: int = 10


@router.post("/train-from-batches")
def train_from_batches(req: TrainFromBatchesRequest):
    rows = (
        container.temp_batches_repo.list(req.user_id)
        if req.user_id
        else container.temp_batches_repo.list_all()
    )
    if req.outcomes:
        rows = [row for row in rows if row.outcome in set(req.outcomes)]

    if len(rows) < req.min_samples:
        return {
            "status": "not_enough_samples",
            "n_samples": len(rows),
            "min_samples": req.min_samples,
        }

    X = np.array([row.features for row in rows], dtype=float)
    container.temp_detector.train_global(X)
    version = f"v{now_iso()}"
    container.models_repo.global_iforest_version = version
    return {"status": "trained", "n_samples": int(X.shape[0]), "version": version}


class TempDetectorStatus(BaseModel):
    model_trained: bool
    model_version: str
    history: dict
    baselines: dict
    feature_order: list[str]


@router.get("/status", response_model=TempDetectorStatus)
def status():
    return TempDetectorStatus(
        model_trained=container.temp_detector.model is not None,
        model_version=container.models_repo.global_iforest_version,
        history=container.temp_batches_repo.stats(),
        baselines=container.temp_baseline_repo.stats(),
        feature_order=list(container.temp_detector.feature_order),
    )


@router.get("/history")
def history(user_id: str | None = Query(default=None)):
    rows = (
        container.temp_batches_repo.list(user_id)
        if user_id
        else container.temp_batches_repo.list_all()
    )
    return {
        "user_id": user_id,
        "total": len(rows),
        "items": [
            TempScoreItem(
                user_id=row.user_id,
                batch_id=row.batch_id,
                outcome=row.outcome,
                quarantined=row.outcome in ("quarantine", "reject"),
                rejected=row.outcome == "reject",
                anomaly_score=row.anomaly_score,
                similarity_score=row.similarity_score,
                heuristic_components=row.heuristic_components,
                reason=None,
                trace={},
                batch=row.payload,
            )
            for row in rows
        ],
    }
