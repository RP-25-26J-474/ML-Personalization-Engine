from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict
import numpy as np

from app.core.schemas.onboarding import OnboardingResult
from app.core.schemas.profile import PROFILE_PASSTHROUGH_FIELDS
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
from app.core.storage.artifact_registry.artifact_store import ArtifactStore

CATEGORY_BEST_KEY = "category_engine/category_best"
CATEGORY_DISTANCE_METRIC = "euclidean"


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
        "motor_impairment": onb.impairment_probs.motor.motor_impairment,
        "literacy": onb.impairment_probs.literacy,
    }


def weighted_aggregate(profiles: list[dict], weights: np.ndarray) -> dict:
    # Numeric mean, boolean vote, categorical vote
    out: dict[str, Any] = {}
    keys = [key for key in profiles[0].keys() if key not in PROFILE_PASSTHROUGH_FIELDS]

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


def augment_category_rows(
    Xdicts: list[dict[str, float]],
    profiles: list[dict],
    copies_per_row: int = 3,
    noise_std: float = 0.03,
    seed: int = 42,
) -> tuple[list[dict[str, float]], list[dict]]:
    rng = np.random.default_rng(seed)
    augmented_X = list(Xdicts)
    augmented_profiles = list(profiles)

    for features, profile in zip(Xdicts, profiles):
        for _ in range(copies_per_row):
            noisy_features: dict[str, float] = {}
            for key in FEATURE_ORDER:
                value = float(features[key])
                noisy = value + float(rng.normal(0.0, noise_std))
                noisy_features[key] = float(max(0.0, min(1.0, noisy)))
            augmented_X.append(noisy_features)
            augmented_profiles.append(dict(profile))

    return augmented_X, augmented_profiles


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

    def _ensure_current_metric(self) -> None:
        if self.artifacts is None:
            return

        if getattr(self.artifacts, "metric", "cosine") == CATEGORY_DISTANCE_METRIC:
            return

        k = int(getattr(self.artifacts.nn, "n_neighbors", 10))
        self.artifacts = train_knn(
            self.artifacts.X,
            self.artifacts.profiles,
            k=k,
            metric=CATEGORY_DISTANCE_METRIC,
        )
        self._save_best()

    def _ensure_artifacts(self, n: int = 400) -> None:
        if self.artifacts is None:
            self.artifacts = self._load_best()
        if self.artifacts is None:
            self.train_from_synth(n=n)
        self._ensure_current_metric()

    def get_artifacts(self, n: int = 400) -> KNNArtifacts:
        self._ensure_artifacts(n=n)
        return self.artifacts

    def train_from_synth(self, n: int = 400) -> None:
        Xdicts, profiles = generate_synth_survey(n=n)
        self.train_from_data(Xdicts, profiles)

    def train_from_data(
        self,
        Xdicts: list[dict[str, float]],
        profiles: list[dict],
        *,
        augment: bool = False,
        copies_per_row: int = 3,
        noise_std: float = 0.03,
        seed: int = 42,
    ) -> int:
        if augment:
            Xdicts, profiles = augment_category_rows(
                Xdicts,
                profiles,
                copies_per_row=copies_per_row,
                noise_std=noise_std,
                seed=seed,
            )

        X = np.array([[d[k] for k in FEATURE_ORDER] for d in Xdicts], dtype=float)
        self.artifacts = train_knn(X, profiles, k=10, metric=CATEGORY_DISTANCE_METRIC)
        self._save_best()
        return len(Xdicts)

    def _compute_confidence(self, avg_dist: float) -> float:
        if self.artifacts is None:
            return 0.0

        if not np.isfinite(avg_dist):
            return 0.0

        distance_scale = float(getattr(self.artifacts, "distance_scale", 1.0) or 1.0)
        normalized_dist = avg_dist / distance_scale
        # This absolute coverage term makes confidence improve as the retrieved
        # neighbors get closer, independent of training-set size.
        coverage_confidence = 1.0 - max(0.0, min(1.0, normalized_dist))

        baseline_mean = getattr(self.artifacts, "train_neighbor_distance_mean", None)
        baseline_std = getattr(self.artifacts, "train_neighbor_distance_std", None)
        n_samples = int(getattr(self.artifacts, "n_samples", 0) or len(self.artifacts.X))

        if baseline_mean is None:
            return float(max(0.0, min(1.0, coverage_confidence)))

        if not baseline_std or baseline_std <= 1e-9:
            relative_confidence = 1.0 if avg_dist <= baseline_mean else 0.0
        else:
            # Avoid over-penalizing normal queries as synthetic sample count
            # grows and the training-neighborhood standard deviation shrinks.
            scale = max(float(baseline_std), float(baseline_mean) * 0.75, 0.05)
            z = (float(baseline_mean) - avg_dist) / scale
            relative_confidence = 1.0 / (1.0 + np.exp(-z))

        sample_confidence = 1.0 - np.exp(-n_samples / 100.0) if n_samples > 0 else 0.0
        confidence = (
            0.70 * coverage_confidence
            + 0.20 * relative_confidence
            + 0.10 * sample_confidence
        )
        return float(max(0.0, min(1.0, confidence)))

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
        distance_scale = float(getattr(self.artifacts, "distance_scale", 1.0) or 1.0)
        nearest_similarity = float(max(0.0, min(1.0, 1.0 - (nearest_distance / distance_scale))))

        neighbor_profiles = [self.artifacts.profiles[i] for i in idxs]
        agg = weighted_aggregate(neighbor_profiles, weights)
        agg = clamp_profile_dict(agg)
        agg["color_blindness"] = onboarding.impairment_probs.vision.color_blindness

        avg_dist = float(np.mean(dists))
        confidence = self._compute_confidence(avg_dist)

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
                "train_neighbor_distance_mean": getattr(self.artifacts, "train_neighbor_distance_mean", None),
                "train_neighbor_distance_std": getattr(self.artifacts, "train_neighbor_distance_std", None),
                "distance_metric": getattr(self.artifacts, "metric", CATEGORY_DISTANCE_METRIC),
                "distance_scale": getattr(self.artifacts, "distance_scale", None),
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
