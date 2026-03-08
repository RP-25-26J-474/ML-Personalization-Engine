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
    trained_at = now_iso()
    version = f"v{trained_at}"
    container.models_repo.global_iforest_version = version
    container.models_repo.global_iforest_last_trained_at = trained_at
    return {"status": "trained", "n_samples": int(X.shape[0]), "version": version}


class TrainFromSynthRequest(BaseModel):
    n_samples: int = 400
    seed: int = 42


@router.post("/train-synth")
def train_synth(req: TrainFromSynthRequest):
    n_samples = container.temp_detector.train_from_synth(n=req.n_samples, seed=req.seed)
    trained_at = now_iso()
    version = f"v{trained_at}"
    container.models_repo.global_iforest_version = version
    container.models_repo.global_iforest_last_trained_at = trained_at
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
    trained_at = now_iso()
    version = f"v{trained_at}"
    container.models_repo.global_iforest_version = version
    container.models_repo.global_iforest_last_trained_at = trained_at
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


class TempTemplateResponse(BaseModel):
    template_found: bool
    user_id: str
    count: int | None = None
    feature_order: list[str] | None = None
    mean: list[float] | None = None
    variance: list[float] | None = None
    std: list[float] | None = None
    updated_at: str | None = None


@router.get("/template", response_model=TempTemplateResponse)
def get_template(user_id: str = Query(..., min_length=1)):
    tpl = container.temp_baseline_repo.get_template(user_id)
    if tpl is None:
        return TempTemplateResponse(
            template_found=False,
            user_id=user_id,
        )
    return TempTemplateResponse(
        template_found=True,
        user_id=user_id,
        count=int(tpl.get("count", 0)),
        feature_order=list(container.temp_detector.feature_order),
        mean=list(tpl.get("mean", [])),
        variance=list(tpl.get("variance", [])),
        std=list(tpl.get("std", [])),
        updated_at=tpl.get("updated_at"),
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


def _serialize_tree(estimator, feature_names: list[str]) -> dict:
    tree = estimator.tree_

    def node(idx: int, depth: int) -> dict:
        feature_index = int(tree.feature[idx])
        is_leaf = tree.children_left[idx] == tree.children_right[idx]
        data = {
            "id": int(idx),
            "depth": int(depth),
            "samples": int(tree.n_node_samples[idx]),
            "feature_index": None if feature_index < 0 else feature_index,
            "feature": feature_names[feature_index] if feature_index >= 0 else None,
            "threshold": None if feature_index < 0 else float(tree.threshold[idx]),
        }
        if not is_leaf:
            data["left"] = node(int(tree.children_left[idx]), depth + 1)
            data["right"] = node(int(tree.children_right[idx]), depth + 1)
        return data

    return {
        "node_count": int(tree.node_count),
        "max_depth": int(tree.max_depth),
        "root": node(0, 0),
    }


@router.get("/forest")
def forest(max_trees: int = Query(default=3, ge=1, le=20)):
    model = container.temp_detector.model
    if model is None:
        return {"status": "untrained", "trees": [], "n_estimators": 0}

    estimators = list(model.estimators_ or [])
    count = min(max_trees, len(estimators))
    trees = [
        {
            "index": idx,
            "tree": _serialize_tree(est, container.temp_detector.feature_order),
        }
        for idx, est in enumerate(estimators[:count])
    ]

    return {
        "status": "ready",
        "n_estimators": len(estimators),
        "trees": trees,
    }
