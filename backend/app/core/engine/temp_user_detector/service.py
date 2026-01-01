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
        self.quarantine_threshold = 0.65  # demo threshold (tune later)
        self.reject_threshold = 0.9  # hard reject for high anomaly

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
            anomaly = min(
                1.0,
                0.5 * batch.events_agg.misclick_rate
                + 0.1 * batch.events_agg.rage_clicks,
            )
            actions.append(TraceAction(type="score_heuristic", details={"anomaly_score": anomaly}))
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
            reason=reason,
            features=feats,
            trace=trace,
        )
