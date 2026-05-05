from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
import numpy as np

from app.api.wiring import container
from app.core.schemas.interactions import InteractionBatch
from app.core.storage.repos.temp_batches_repo import TempBatchRecord
from app.core.utils.time import now_iso

router = APIRouter()


def _store_scored_batch(batch: InteractionBatch, res) -> None:
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


def _feature_rows_from_templates(user_id: str | None, expected_width: int) -> list[list[float]]:
    rows: list[list[float]] = []
    for template in container.temp_baseline_repo.list_templates(user_id):
        mean = list(template.get("mean") or [])
        if len(mean) != expected_width:
            continue
        count = max(1, int(template.get("count") or 1))
        rows.extend([mean] * count)
    return rows


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


@router.post(
    "/score-batch",
    response_model=TempScoreResponse,
    summary="Score one interaction batch",
    description="Computes anomaly/similarity signals and returns keep, quarantine, or reject outcome.",
)
def score_batch(batch: InteractionBatch):
    res = container.temp_detector.score_batch(batch)
    _store_scored_batch(batch, res)
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
    feature_matrix: list[list[float]] = Field(
        description="Matrix of detector feature vectors used to train the global anomaly model."
    )


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
    batches: list[InteractionBatch] = Field(
        description="List of interaction batches to score in one request."
    )


class TempScoreBatchesResponse(BaseModel):
    summary: dict
    kept: list[TempScoreItem]
    quarantined: list[TempScoreItem]
    rejected: list[TempScoreItem]


@router.post(
    "/score-batches",
    response_model=TempScoreBatchesResponse,
    summary="Score multiple interaction batches",
    description="Scores many batches in one call and groups results by outcome type.",
)
def score_batches(req: TempScoreBatchesRequest):
    results = container.temp_detector.score_batches(req.batches)
    kept: list[TempScoreItem] = []
    quarantined: list[TempScoreItem] = []
    rejected: list[TempScoreItem] = []

    for batch, res in zip(req.batches, results):
        _store_scored_batch(batch, res)
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


@router.post(
    "/train-global",
    summary="Train global anomaly model",
    description="Trains the temp-detector model from explicit feature vectors.",
)
def train_global(req: TrainGlobalRequest):
    X = np.array(req.feature_matrix, dtype=float)
    container.temp_detector.train_global(X)
    trained_at = now_iso()
    version = f"v{trained_at}"
    container.models_repo.global_iforest_version = version
    container.models_repo.global_iforest_last_trained_at = trained_at
    return {"status": "trained", "n_samples": int(X.shape[0]), "version": version}


class TrainFromSynthRequest(BaseModel):
    n_samples: int = Field(default=400, description="Number of synthetic rows to generate.")
    seed: int = Field(default=42, description="Random seed for deterministic synthetic training data.")


@router.post(
    "/train-synth",
    summary="Train anomaly model from synthetic data",
    description="Generates synthetic detector features and retrains the global anomaly model.",
)
def train_synth(req: TrainFromSynthRequest):
    n_samples = container.temp_detector.train_from_synth(n=req.n_samples, seed=req.seed)
    trained_at = now_iso()
    version = f"v{trained_at}"
    container.models_repo.global_iforest_version = version
    container.models_repo.global_iforest_last_trained_at = trained_at
    return {"status": "trained", "n_samples": n_samples, "version": version}


class TrainFromBatchesRequest(BaseModel):
    user_id: str | None = Field(
        default=None, description="Optional user filter; uses all users when omitted."
    )
    outcomes: list[str] = Field(
        default_factory=lambda: ["keep"],
        description="Outcome labels to include when selecting stored batches.",
    )
    min_samples: int = Field(default=50, ge=1, description="Minimum required sample count before training.")
    contamination: float = Field(
        default=0.10,
        ge=0.001,
        le=0.5,
        description="Expected anomaly fraction for Isolation Forest training.",
    )
    quarantine_percentile: float = Field(
        default=95.0,
        ge=50.0,
        le=99.9,
        description="Percentile of kept-batch model scores used as quarantine threshold.",
    )
    reject_percentile: float = Field(
        default=99.0,
        ge=50.0,
        le=99.99,
        description="Percentile of kept-batch model scores used as reject threshold.",
    )


@router.post(
    "/train-from-batches",
    summary="Train anomaly model from stored batches",
    description="Retrains the detector using historical scored batches filtered by user and outcome.",
)
def train_from_batches(req: TrainFromBatchesRequest):
    if req.reject_percentile <= req.quarantine_percentile:
        return {
            "status": "invalid_calibration",
            "message": "reject_percentile must be greater than quarantine_percentile.",
            "n_samples": 0,
            "min_samples": req.min_samples,
        }

    rows = (
        container.temp_batches_repo.list(req.user_id)
        if req.user_id
        else container.temp_batches_repo.list_all()
    )
    allowed = set(req.outcomes or ["keep"])
    rows = [row for row in rows if row.outcome in allowed]
    expected_width = len(container.temp_detector.feature_order)
    rows = [row for row in rows if len(row.features) == expected_width]
    feature_rows = [row.features for row in rows]
    source = "stored_batches"

    if len(feature_rows) < req.min_samples and allowed == {"keep"}:
        feature_rows = _feature_rows_from_templates(req.user_id, expected_width)
        source = "baseline_templates"

    if len(feature_rows) < req.min_samples:
        return {
            "status": "not_enough_samples",
            "n_samples": len(feature_rows),
            "min_samples": req.min_samples,
            "outcomes": sorted(allowed),
            "user_id": req.user_id,
            "source": source,
        }

    stats = container.temp_detector.train_from_feature_rows(
        feature_rows,
        contamination=req.contamination,
        quarantine_percentile=req.quarantine_percentile,
        reject_percentile=req.reject_percentile,
    )
    trained_at = now_iso()
    version = f"v{trained_at}"
    container.models_repo.global_iforest_version = version
    container.models_repo.global_iforest_last_trained_at = trained_at
    return {
        "status": "trained",
        "version": version,
        "source": source,
        "outcomes": sorted(allowed),
        "user_id": req.user_id,
        **stats,
    }


class TempDetectorStatus(BaseModel):
    model_trained: bool
    model_version: str
    n_estimators: int
    history: dict
    baselines: dict
    feature_order: list[str]


@router.get(
    "/status",
    response_model=TempDetectorStatus,
    summary="Get temp-detector status",
    description="Returns detector training status, model version, history stats, and per-user baseline stats.",
)
def status():
    history = container.temp_batches_repo.stats()
    model = container.temp_detector.model
    estimators = getattr(model, "estimators_", None) if model is not None else None
    return TempDetectorStatus(
        model_trained=model is not None,
        model_version=container.models_repo.global_iforest_version,
        n_estimators=len(estimators or []),
        history=history,
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


@router.get(
    "/template",
    response_model=TempTemplateResponse,
    summary="Get user baseline template",
    description="Fetches an existing baseline template for the target user, if available.",
)
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


@router.get(
    "/forest",
    summary="Inspect trained forest",
    description="Serializes trained isolation-forest trees for debugging and visualization.",
)
def forest(max_trees: int | None = Query(default=None, ge=1)):
    model = container.temp_detector.model
    if model is None:
        return {"status": "untrained", "trees": [], "n_estimators": 0}

    estimators = list(model.estimators_ or [])
    count = len(estimators) if max_trees is None else min(max_trees, len(estimators))
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
