from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
import numpy as np
from importlib import import_module
from datetime import datetime
from typing import Any
import json
from urllib.parse import urlencode, urljoin
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

from app.api.wiring import container
from app.core.schemas.interactions import InteractionBatch, InteractionBatchList
from app.core.schemas.profile import PersonalizationProfile, ProfileKnobs, ProfileMetadata
from app.core.utils.time import now_iso
from app.core.utils.ids import new_id
from app.core.config import settings
from app.core.engine.constraints.clamp import clamp_profile_dict

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


class TriggerUserEngineResponse(BaseModel):
    user_id: str
    fetched_batches: int
    processed_batches: int
    feedback_payload_received: bool = False
    applied_feedback_overrides: list[str] = Field(default_factory=list)
    skipped_feedback_overrides: list[dict] = Field(default_factory=list)
    quarantined: bool
    kept_batches: list[str]
    quarantined_batches: list[dict]
    rejected_batches: list[dict]
    profile: dict | None = None
    diff: dict | None = None
    traces: list[dict]


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


class SequenceReadinessResponse(BaseModel):
    ready: bool
    n_users: int
    n_sequences: int
    min_users: int
    min_sequences: int
    min_sequence_len: int
    max_sequence_len: int
    outcome_filter: list[str]
    total_batches: int
    selected_batches: int
    outcome_counts: dict[str, int]


class FeedbackOverrideItem(BaseModel):
    attribute: str
    old_value: Any = None
    new_value: Any = None


class TriggerUpdateBody(BaseModel):
    user_id: str = Field(min_length=1)
    session_id: str | None = None
    base_profile_version: int | None = None
    sent_at: str | None = None
    feedback_overrides: list[FeedbackOverrideItem] = Field(default_factory=list)


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


def _parse_iso(ts: str) -> datetime:
    raw = (ts or "").strip()
    if not raw:
        return datetime.min
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min


def _normalize_external_batch(user_id: str, row: dict, idx: int) -> InteractionBatch | None:
    captured_at = (
        row.get("captured_at")
        or row.get("capturedAt")
        or row.get("timestamp")
        or row.get("created_at")
        or row.get("createdAt")
    )
    if not isinstance(captured_at, str) or not captured_at.strip():
        return None

    page_context = row.get("page_context") or row.get("pageContext") or {}
    if not isinstance(page_context, dict):
        page_context = {}

    events_agg = row.get("events_agg") or row.get("eventsAgg") or row.get("aggregates") or {}
    if not isinstance(events_agg, dict):
        return None

    batch_id_raw = row.get("batch_id") or row.get("batchId") or row.get("id")
    batch_id = str(batch_id_raw).strip() if batch_id_raw is not None else ""
    if not batch_id:
        batch_id = new_id(f"ext_b{idx}")

    try:
        return InteractionBatch.model_validate(
            {
                "user_id": user_id,
                "batch_id": batch_id,
                "captured_at": captured_at,
                "page_context": page_context,
                "events_agg": events_agg,
            }
        )
    except Exception:
        return None


def _fetch_external_batches(user_id: str) -> list[InteractionBatch]:
    base = settings.EXT_BACKEND_BASE_URL.rstrip("/") + "/"
    path = settings.EXT_BACKEND_INTERACTIONS_BATCH_PATH.lstrip("/")
    url = urljoin(base, path)
    query = urlencode({"user_id": user_id})
    req = Request(f"{url}?{query}", headers={"Accept": "application/json"}, method="GET")

    try:
        with urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"extension backend returned HTTP {exc.code} for user_id={user_id}",
        ) from exc
    except URLError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"failed to reach extension backend for user_id={user_id}: {exc.reason}",
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail=f"timeout while fetching extension batches for user_id={user_id}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"failed to parse extension backend response for user_id={user_id}",
        ) from exc

    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = payload.get("batches") or payload.get("items") or []
    else:
        rows = []

    if not isinstance(rows, list):
        rows = []

    parsed: list[InteractionBatch] = []
    for idx, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        batch = _normalize_external_batch(user_id=user_id, row=row, idx=idx)
        if batch is not None:
            parsed.append(batch)

    parsed.sort(key=lambda b: _parse_iso(b.captured_at), reverse=True)
    return parsed[:50]


def _apply_feedback_overrides(user_id: str, payload: TriggerUpdateBody | None) -> tuple[list[str], list[dict]]:
    if payload is None or not payload.feedback_overrides:
        return [], []

    prev = container.profiles_repo.get_latest(user_id)
    if prev is None:
        return [], [{"reason": "no_existing_profile", "attribute": "*"}]

    allowed = set(ProfileKnobs.model_fields.keys())
    merged_profile = prev.profile.model_dump()
    applied: list[str] = []
    skipped: list[dict] = []

    for item in payload.feedback_overrides:
        attr = item.attribute.strip()
        if attr not in allowed:
            skipped.append({"attribute": item.attribute, "reason": "unknown_attribute"})
            continue

        candidate = dict(merged_profile)
        candidate[attr] = item.new_value
        candidate = clamp_profile_dict(candidate)
        try:
            validated = ProfileKnobs.model_validate(candidate).model_dump()
        except Exception:
            skipped.append({"attribute": item.attribute, "reason": "invalid_new_value"})
            continue

        merged_profile = validated
        applied.append(attr)

    if not applied:
        return applied, skipped

    next_version = prev.metadata.version + 1
    profile = PersonalizationProfile(
        user_id=user_id,
        metadata=ProfileMetadata(
            origin="user",
            created_at=now_iso(),
            confidence_overall=prev.metadata.confidence_overall,
            version=next_version,
        ),
        profile=ProfileKnobs(**merged_profile),
    )
    container.profiles_repo.save_version(profile)
    return applied, skipped


def _build_user_sequences(
    outcomes: list[str],
    min_sequence_len: int,
    max_sequence_len: int,
) -> tuple[list[list[InteractionBatch]], dict[str, Any]]:
    seq_autoencoder = _seq_autoencoder()
    all_rows = container.temp_batches_repo.list_all()
    outcome_counts = {"keep": 0, "quarantine": 0, "reject": 0}
    for row in all_rows:
        if row.outcome in outcome_counts:
            outcome_counts[row.outcome] += 1

    rows = all_rows
    if outcomes:
        allowed = set(outcomes)
        rows = [row for row in rows if row.outcome in allowed]

    users: dict[str, list] = {}
    for row in rows:
        users.setdefault(row.user_id, []).append(row)

    sequences: list[list[InteractionBatch]] = []
    for user_rows in users.values():
        ordered = sorted(
            user_rows,
            key=lambda r: seq_autoencoder.parse_timestamp(r.captured_at),
        )
        batches = [InteractionBatch(**r.payload) for r in ordered]
        if len(batches) >= min_sequence_len:
            sequences.append(batches[-max_sequence_len:])

    return sequences, {
        "total_batches": len(all_rows),
        "selected_batches": len(rows),
        "outcome_counts": outcome_counts,
    }


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
    "/trigger-update",
    response_model=TriggerUserEngineResponse,
    summary="Trigger user engine from extension backend history",
    description=(
        "Fetches latest aggregated interaction batches from the extension backend for a user, "
        "runs temp-detector gating, and persists user profile updates."
    ),
)
def trigger_update(
    user_id: str | None = Query(default=None, min_length=1, description="Identifier of the user to process."),
    payload: TriggerUpdateBody | None = Body(default=None),
):
    resolved_user_id = (payload.user_id if payload is not None else None) or user_id
    if not resolved_user_id:
        raise HTTPException(status_code=400, detail="user_id is required either as query param or request body")
    if payload is not None and user_id is not None and payload.user_id != user_id:
        raise HTTPException(status_code=400, detail="user_id mismatch between query param and request body")

    applied_overrides, skipped_overrides = _apply_feedback_overrides(
        user_id=resolved_user_id,
        payload=payload,
    )

    batches = _fetch_external_batches(user_id=resolved_user_id)
    if not batches:
        raise HTTPException(
            status_code=404,
            detail=f"no valid interaction batches found for user_id={resolved_user_id}",
        )

    out = container.orchestrator.handle_interactions_many(batches)
    return TriggerUserEngineResponse(
        user_id=resolved_user_id,
        fetched_batches=len(batches),
        processed_batches=len(out.kept_batches) + len(out.quarantined_batches) + len(out.rejected_batches),
        feedback_payload_received=payload is not None,
        applied_feedback_overrides=applied_overrides,
        skipped_feedback_overrides=skipped_overrides,
        quarantined=out.quarantined,
        kept_batches=out.kept_batches,
        quarantined_batches=out.quarantined_batches,
        rejected_batches=out.rejected_batches,
        profile=out.profile.model_dump() if out.profile else None,
        diff=out.diff.model_dump() if out.diff else None,
        traces=[t.model_dump() for t in out.traces.traces],
    )


@router.post(
    "/train-seq-model",
    response_model=TrainSeqModelResponse,
    summary="Train user sequence model",
    description="Trains the GRU autoencoder + clustering bundle used for user behavior sequence personalization.",
)
def train_seq_model(req: TrainSeqModelRequest):
    seq_autoencoder = _seq_autoencoder()
    sequences, _ = _build_user_sequences(
        outcomes=req.outcomes,
        min_sequence_len=req.min_sequence_len,
        max_sequence_len=req.max_sequence_len,
    )

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


@router.get(
    "/sequence-readiness",
    response_model=SequenceReadinessResponse,
    summary="Get user sequence training readiness",
    description="Returns the same trainable sequence counts used by the user sequence model trainer.",
)
def sequence_readiness(
    outcomes: list[str] = Query(default=[]),
    min_users: int = 5,
    min_sequences: int = 20,
    min_sequence_len: int = 2,
    max_sequence_len: int = 20,
):
    sequences, stats = _build_user_sequences(
        outcomes=list(outcomes),
        min_sequence_len=min_sequence_len,
        max_sequence_len=max_sequence_len,
    )
    n_users = len(sequences)
    n_sequences = len(sequences)
    return SequenceReadinessResponse(
        ready=n_users >= min_users and n_sequences >= min_sequences,
        n_users=n_users,
        n_sequences=n_sequences,
        min_users=min_users,
        min_sequences=min_sequences,
        min_sequence_len=min_sequence_len,
        max_sequence_len=max_sequence_len,
        outcome_filter=list(outcomes),
        total_batches=int(stats["total_batches"]),
        selected_batches=int(stats["selected_batches"]),
        outcome_counts=stats["outcome_counts"],
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
