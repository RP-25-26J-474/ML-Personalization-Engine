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
        self.threshold = 0.65  # demo threshold (tune later)

    def train_global(self, feature_matrix: np.ndarray) -> None:
        self.model = new_iforest()
        self.model.fit(feature_matrix)

    def score_batch(self, batch: InteractionBatch) -> TempFilterResult:
        x = extract_features(batch)
        feats = x.tolist()

        actions: list[TraceAction] = [
            TraceAction(type="feature_extract", details={"features": ["click_count","misclick_rate","avg_click_interval_ms","avg_dwell_ms","rage_clicks","zoom_events","scroll_speed_px_s"]})
        ]

        if self.model is None:
            # Heuristic anomaly proxy for demo:
            anomaly = min(1.0, 0.5 * batch.events_agg.misclick_rate + 0.1 * batch.events_agg.rage_clicks)
            actions.append(TraceAction(type="score_heuristic", details={"anomaly_score": anomaly}))
        else:
            anomaly = score_anomaly(self.model, x)
            actions.append(TraceAction(type="score_iforest", details={"anomaly_score": anomaly, "threshold": self.threshold}))

        is_q = anomaly >= self.threshold
        reason = "high_anomaly_score" if is_q else None
        if is_q:
            actions.append(TraceAction(type="quarantine", details={"reason": reason}))
        else:
            actions.append(TraceAction(type="keep", details={}))

        trace = DecisionTrace(
            trace_id=new_id("tr"),
            stage="temp_user_filter",
            inputs_summary={"user_id": batch.user_id, "batch_id": batch.batch_id},
            actions=actions,
            metrics={"anomaly_score": anomaly, "threshold": self.threshold},
            warnings=[],
        )

        return TempFilterResult(
            is_quarantined=is_q,
            anomaly_score=anomaly,
            reason=reason,
            features=feats,
            trace=trace,
        )
