from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any

import numpy as np
from sklearn.ensemble import IsolationForest

from app.core.schemas.interactions import InteractionBatch
from app.core.schemas.trace import DecisionTrace, TraceAction
from app.core.utils.ids import new_id

from app.core.engine.temp_user_detector.features import extract_features
from app.core.engine.temp_user_detector.model_iforest import new_iforest, score_anomaly


@dataclass
class TempFilterResult:
    is_quarantined: bool
    is_rejected: bool
    outcome: str
    anomaly_score: float
    similarity_score: float
    reason: str | None
    features: list[float]
    trace: DecisionTrace


class TempUserDetectorService:
    """
    Demo behavior:
      - maintain a global IsolationForest (optional)
      - if not trained, fall back to heuristic scoring
    """

    def __init__(self, model: IsolationForest | None = None):
        self.model = model
        self.quarantine_threshold = 0.6  # demo threshold (tune later)
        self.reject_threshold = 0.85  # hard reject for high anomaly

    def train_global(self, feature_matrix: np.ndarray) -> None:
        self.model = new_iforest()
        self.model.fit(feature_matrix)

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

        if self.model is None:
            # Heuristic anomaly proxy for demo:
            anomaly, detail = self._heuristic_anomaly(batch)
            actions.append(
                TraceAction(
                    type="score_heuristic",
                    details={"anomaly_score": anomaly, "components": detail},
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
            reason=reason,
            features=feats,
            trace=trace,
        )

    def _heuristic_anomaly(self, batch: InteractionBatch) -> tuple[float, dict[str, float]]:
        def norm(value: float, low: float, high: float) -> float:
            return self._norm(value, low, high)

        misclick_score = self._clamp01(batch.events_agg.misclick_rate)
        rage_score = self._clamp01(batch.events_agg.rage_clicks / 6.0)
        click_interval_score = 1.0 - norm(batch.events_agg.avg_click_interval_ms, 150.0, 600.0)
        dwell_score = 1.0 - norm(batch.events_agg.avg_dwell_ms, 300.0, 2000.0)
        scroll_score = norm(batch.events_agg.scroll_speed_px_s, 200.0, 700.0)

        anomaly = (
            0.35 * misclick_score
            + 0.25 * rage_score
            + 0.15 * click_interval_score
            + 0.15 * dwell_score
            + 0.10 * scroll_score
        )

        detail = {
            "misclick_score": misclick_score,
            "rage_score": rage_score,
            "click_interval_score": click_interval_score,
            "dwell_score": dwell_score,
            "scroll_score": scroll_score,
        }
        return min(1.0, anomaly), detail

    def _similarity_score(self, batch: InteractionBatch) -> float:
        e = batch.events_agg
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
