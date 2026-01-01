from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any

import numpy as np
from sklearn.ensemble import IsolationForest

from app.core.schemas.interactions import InteractionBatch
from app.core.schemas.trace import DecisionTrace, TraceAction
from app.core.utils.ids import new_id

from app.core.engine.temp_user_detector.features import extract_features, FEATURE_ORDER
from app.core.engine.temp_user_detector.model_iforest import new_iforest, score_anomaly
from app.core.engine.temp_user_detector.synth_data import generate_synth_interactions
from app.core.storage.artifacts.artifact_store import ArtifactStore
from app.core.storage.repos.temp_baseline_repo import TempBaselineRepo


@dataclass
class TempFilterResult:
    is_quarantined: bool
    is_rejected: bool
    outcome: str
    anomaly_score: float
    similarity_score: float
    heuristic_components: dict[str, float]
    reason: str | None
    features: list[float]
    trace: DecisionTrace


class TempUserDetectorService:
    """
    Demo behavior:
      - maintain a global IsolationForest (optional)
      - if not trained, fall back to heuristic scoring
    """

    def __init__(
        self,
        model: IsolationForest | None = None,
        artifact_store: ArtifactStore | None = None,
        baseline_repo: TempBaselineRepo | None = None,
    ):
        self.artifact_store = artifact_store or ArtifactStore()
        self.model = model or self._load_best()
        self.baseline_repo = baseline_repo or TempBaselineRepo()
        self.quarantine_threshold = 0.50  # demo threshold (tune later)
        self.reject_threshold = 0.75  # hard reject for high anomaly
        self.feature_order = list(FEATURE_ORDER)

    def train_global(self, feature_matrix: np.ndarray) -> None:
        self.model = new_iforest()
        self.model.fit(feature_matrix)
        self._save_best()

    def train_from_synth(self, n: int = 400, seed: int = 42) -> int:
        rows = generate_synth_interactions(n=n, seed=seed)
        X = np.array([[row[k] for k in self.feature_order] for row in rows], dtype=float)
        self.train_global(X)
        return int(X.shape[0])

    def score_batch(self, batch: InteractionBatch) -> TempFilterResult:
        return self._score_batch_internal(batch)

    def score_batches(self, batches: list[InteractionBatch]) -> list[TempFilterResult]:
        return [self._score_batch_internal(batch) for batch in batches]

    def _score_batch_internal(self, batch: InteractionBatch) -> TempFilterResult:
        x = extract_features(batch)
        feats = x.tolist()

        actions: list[TraceAction] = [
            TraceAction(
                type="feature_extract",
                details={
                    "features": [
                        "click_count",
                        "misclick_rate",
                        "avg_click_interval_ms",
                        "avg_dwell_ms",
                        "rage_clicks",
                        "zoom_events",
                        "scroll_speed_px_s",
                    ]
                },
            )
        ]

        heuristic_components = self._heuristic_components(batch)
        if self.model is None:
            # Heuristic anomaly proxy for demo:
            anomaly = self._heuristic_anomaly_from_components(heuristic_components)
            actions.append(
                TraceAction(
                    type="score_heuristic",
                    details={
                        "anomaly_score": anomaly,
                        "components": heuristic_components,
                    },
                )
            )
        else:
            anomaly = score_anomaly(self.model, x)
            actions.append(
                TraceAction(
                    type="score_iforest",
                    details={
                        "anomaly_score": anomaly,
                        "quarantine_threshold": self.quarantine_threshold,
                        "reject_threshold": self.reject_threshold,
                        "heuristic_components": heuristic_components,
                    },
                )
            )

        similarity = self._similarity_score(batch)

        if anomaly >= self.reject_threshold:
            outcome = "reject"
            reason = "high_anomaly_score_reject"
            actions.append(TraceAction(type="reject", details={"reason": reason}))
        elif anomaly >= self.quarantine_threshold:
            outcome = "quarantine"
            reason = "high_anomaly_score_quarantine"
            actions.append(TraceAction(type="quarantine", details={"reason": reason}))
        else:
            outcome = "keep"
            reason = None
            actions.append(TraceAction(type="keep", details={}))

        trace = DecisionTrace(
            trace_id=new_id("tr"),
            stage="temp_user_filter",
            inputs_summary={"user_id": batch.user_id, "batch_id": batch.batch_id},
            actions=actions,
            metrics={
                "anomaly_score": anomaly,
                "similarity_score": similarity,
                "quarantine_threshold": self.quarantine_threshold,
                "reject_threshold": self.reject_threshold,
            },
            warnings=[],
        )

        return TempFilterResult(
            is_quarantined=outcome in ("quarantine", "reject"),
            is_rejected=outcome == "reject",
            outcome=outcome,
            anomaly_score=anomaly,
            similarity_score=similarity,
            heuristic_components=heuristic_components,
            reason=reason,
            features=feats,
            trace=trace,
        )

    def update_baseline(self, user_id: str, features: list[float]) -> None:
        self.baseline_repo.update(user_id, features)

    def get_baseline(self, user_id: str) -> list[float] | None:
        return self.baseline_repo.get(user_id)

    def _load_best(self) -> IsolationForest | None:
        return self.artifact_store.load("temp_detector/iforest_best")

    def _save_best(self) -> None:
        if self.model is not None:
            self.artifact_store.save("temp_detector/iforest_best", self.model)

    def _heuristic_components(self, batch: InteractionBatch) -> dict[str, float]:
        def norm(value: float, low: float, high: float) -> float:
            return self._norm(value, low, high)

        return {
            "misclick_score": self._clamp01(batch.events_agg.misclick_rate),
            "rage_score": self._clamp01(batch.events_agg.rage_clicks / 6.0),
            "click_interval_score": 1.0
            - norm(batch.events_agg.avg_click_interval_ms, 150.0, 600.0),
            "dwell_score": 1.0 - norm(batch.events_agg.avg_dwell_ms, 300.0, 2000.0),
            "scroll_score": norm(batch.events_agg.scroll_speed_px_s, 200.0, 700.0),
        }

    def _heuristic_anomaly_from_components(self, components: dict[str, float]) -> float:
        anomaly = (
            0.35 * components.get("misclick_score", 0.0)
            + 0.25 * components.get("rage_score", 0.0)
            + 0.15 * components.get("click_interval_score", 0.0)
            + 0.15 * components.get("dwell_score", 0.0)
            + 0.10 * components.get("scroll_score", 0.0)
        )
        return min(1.0, anomaly)

    def _similarity_score(self, batch: InteractionBatch) -> float:
        e = batch.events_agg
        baseline = self.baseline_repo.get(batch.user_id)
        if baseline:
            base = {
                key: float(val) for key, val in zip(self.feature_order, baseline)
            }
        else:
            # Typical primary user interaction profile (demo baseline)
            base = {
                "click_count": 22.0,
                "misclick_rate": 0.08,
                "avg_click_interval_ms": 420.0,
                "avg_dwell_ms": 1800.0,
                "rage_clicks": 0.0,
                "zoom_events": 1.0,
                "scroll_speed_px_s": 260.0,
            }

        vec = [
            self._norm(e.click_count, 5.0, 40.0),
            self._clamp01(e.misclick_rate),
            self._norm(e.avg_click_interval_ms, 150.0, 600.0),
            self._norm(e.avg_dwell_ms, 300.0, 2000.0),
            self._norm(e.rage_clicks, 0.0, 6.0),
            self._norm(e.zoom_events, 0.0, 5.0),
            self._norm(e.scroll_speed_px_s, 200.0, 700.0),
        ]

        base_vec = [
            self._norm(base["click_count"], 5.0, 40.0),
            self._clamp01(base["misclick_rate"]),
            self._norm(base["avg_click_interval_ms"], 150.0, 600.0),
            self._norm(base["avg_dwell_ms"], 300.0, 2000.0),
            self._norm(base["rage_clicks"], 0.0, 6.0),
            self._norm(base["zoom_events"], 0.0, 5.0),
            self._norm(base["scroll_speed_px_s"], 200.0, 700.0),
        ]

        dist = float(np.linalg.norm(np.array(vec) - np.array(base_vec)))
        max_dist = np.sqrt(len(vec))
        similarity = 1.0 - (dist / max_dist if max_dist else 0.0)
        return self._clamp01(similarity)

    @staticmethod
    def _clamp01(value: float) -> float:
        return max(0.0, min(1.0, value))

    def _norm(self, value: float, low: float, high: float) -> float:
        if high <= low:
            return 0.0
        return self._clamp01((value - low) / (high - low))
