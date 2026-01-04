from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict
import numpy as np

from app.core.schemas.onboarding import OnboardingResult
from app.core.schemas.trace import DecisionTrace, TraceAction
from app.core.utils.ids import new_id

from app.core.engine.constraints.clamp import clamp_profile_dict
from app.core.engine.category_engine.model_knn import (
    KNNArtifacts,
    FEATURE_ORDER,
    build_query_vector,
    train_knn,
)
from app.core.engine.category_engine.synth_data import generate_synth_survey
from app.core.storage.artifacts.artifact_store import ArtifactStore

CATEGORY_BEST_KEY = "category_engine/category_best"


@dataclass
class CategoryResult:
    profile_dict: Dict[str, Any]
    confidence: float
    nearest_neighbor_distance: float
    nearest_neighbor_similarity: float
    neighbor_indices: list[int]
    neighbor_distances: list[float]
    trace: DecisionTrace


def flatten_impairment_probs(onb: OnboardingResult) -> dict[str, float]:
    return {
        "vision_loss": onb.impairment_probs.vision.vision_loss,
        "color_blindness": onb.impairment_probs.vision.color_blindness,
        "delayed_reaction": onb.impairment_probs.motor.delayed_reaction,
        "inaccurate_click": onb.impairment_probs.motor.inaccurate_click,
        "tremor": onb.impairment_probs.motor.tremor,
        "literacy": onb.impairment_probs.literacy,
    }


def weighted_aggregate(profiles: list[dict], weights: np.ndarray) -> dict:
    # Numeric mean, boolean vote, categorical vote
    out: dict[str, Any] = {}
    keys = profiles[0].keys()

    for k in keys:
        vals = [p[k] for p in profiles]
        w = weights

        # bool
        if isinstance(vals[0], bool):
            score = float(np.sum(w * np.array([1.0 if v else 0.0 for v in vals])))
            out[k] = score >= 0.5 * float(np.sum(w))

        # numeric
        elif isinstance(vals[0], (int, float)):
            out[k] = float(np.sum(w * np.array(vals, dtype=float)) / float(np.sum(w)))

            # keep ints as int for your int knobs
            if isinstance(vals[0], int):
                out[k] = int(round(out[k], 0))

        # categorical / string
        else:
            # weighted mode
            bucket: dict[Any, float] = {}
            for v, ww in zip(vals, w):
                bucket[v] = bucket.get(v, 0.0) + float(ww)
            out[k] = max(bucket.items(), key=lambda kv: kv[1])[0]

    return out


class CategoryEngineService:
    def __init__(
        self,
        artifacts: KNNArtifacts | None = None,
        artifact_store: ArtifactStore | None = None,
    ):
        self.artifact_store = artifact_store or ArtifactStore()
        self.artifacts = artifacts
        if self.artifacts is None:
            self.artifacts = self._load_best()

    def _load_best(self) -> KNNArtifacts | None:
        return self.artifact_store.load(CATEGORY_BEST_KEY)

    def _save_best(self) -> None:
        if self.artifacts is not None:
            self.artifact_store.save(CATEGORY_BEST_KEY, self.artifacts)

    def _ensure_artifacts(self, n: int = 400) -> None:
        if self.artifacts is None:
            self.artifacts = self._load_best()
        if self.artifacts is None:
            self.train_from_synth(n=n)

    def get_artifacts(self, n: int = 400) -> KNNArtifacts:
        self._ensure_artifacts(n=n)
        return self.artifacts

    def train_from_synth(self, n: int = 400) -> None:
        Xdicts, profiles = generate_synth_survey(n=n)
        X = np.array([[d[k] for k in FEATURE_ORDER] for d in Xdicts], dtype=float)
        self.artifacts = train_knn(X, profiles, k=10, metric="cosine")
        self._save_best()

    def generate(self, onboarding: OnboardingResult) -> CategoryResult:
        self._ensure_artifacts(n=400)

        qdict = flatten_impairment_probs(onboarding)
        q = build_query_vector(qdict)

        dists, idxs = self.artifacts.nn.kneighbors(q.reshape(1, -1))
        dists = dists[0]
        idxs = idxs[0]

        # Turn distances into weights (closer = heavier)
        # Add epsilon to avoid div-by-zero
        eps = 1e-6
        weights = 1.0 / (dists + eps)
        weights = weights / np.sum(weights)

        neighbor_indices = idxs.tolist()
        neighbor_distances = dists.tolist()

        nearest_distance = float(np.min(dists))
        nearest_idx = int(idxs[int(np.argmin(dists))])
        nearest_similarity = float(max(0.0, min(1.0, 1.0 - nearest_distance)))

        neighbor_profiles = [self.artifacts.profiles[i] for i in idxs]
        agg = weighted_aggregate(neighbor_profiles, weights)
        agg = clamp_profile_dict(agg)

        # Confidence: inverse of average distance (scaled)
        avg_dist = float(np.mean(dists))
        confidence = float(max(0.0, min(1.0, 1.0 - avg_dist)))  # cosine dist in [0,2], often <=1

        trace = DecisionTrace(
            trace_id=new_id("tr"),
            stage="category_engine_knn",
            inputs_summary={"user_id": onboarding.user_id, "session_id": onboarding.session_id},
            actions=[
                TraceAction(type="build_query_vector", details={"q": qdict}),
                TraceAction(type="knn_retrieve", details={"k": len(idxs), "indices": idxs.tolist(), "distances": dists.tolist()}),
                TraceAction(type="nearest_neighbor", details={"index": nearest_idx, "distance": nearest_distance}),
                TraceAction(type="aggregate_weighted", details={"weights": weights.tolist()}),
                TraceAction(type="clamp", details={}),
            ],
            metrics={
                "avg_neighbor_distance": avg_dist,
                "nearest_neighbor_distance": nearest_distance,
                "nearest_neighbor_similarity": nearest_similarity,
                "confidence_overall": confidence,
            },
            warnings=[],
        )

        return CategoryResult(
            profile_dict=agg,
            confidence=confidence,
            nearest_neighbor_distance=nearest_distance,
            nearest_neighbor_similarity=nearest_similarity,
            neighbor_indices=neighbor_indices,
            neighbor_distances=neighbor_distances,
            trace=trace,
        )
