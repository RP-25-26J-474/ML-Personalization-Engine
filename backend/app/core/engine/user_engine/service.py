from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any

from app.core.schemas.interactions import InteractionBatch
from app.core.schemas.trace import DecisionTrace, TraceAction
from app.core.utils.ids import new_id


@dataclass
class UserResult:
    suggestion_dict: Dict[str, Any]
    confidence: float
    trace: DecisionTrace


class UserEngineService:
    """
    Demo: produce small “delta suggestions” based on interaction aggregates.
    Replace this later with SGD incremental training.
    """

    def suggest(self, batch: InteractionBatch) -> UserResult:
        e = batch.events_agg

        suggestion: Dict[str, Any] = {}

        # If many misclicks -> increase target size / spacing slightly
        if e.misclick_rate >= 0.15 or e.rage_clicks >= 2:
            suggestion["target_size"] = 32
            suggestion["element_spacing_x"] = 8
            suggestion["element_spacing_y"] = 4

        # If zoom events -> bigger font
        if e.zoom_events >= 2:
            suggestion["font_size"] = 14

        # If long dwell and high click interval -> maybe tooltip assist
        if e.avg_dwell_ms >= 3000 and e.avg_click_interval_ms >= 900:
            suggestion["tooltip_assist"] = True

        # Confidence increases with “signal”
        signal = min(1.0, (e.misclick_rate + 0.1 * e.zoom_events + 0.05 * e.rage_clicks))
        confidence = 0.70 + 0.20 * signal

        trace = DecisionTrace(
            trace_id=new_id("tr"),
            stage="user_engine",
            inputs_summary={"user_id": batch.user_id, "batch_id": batch.batch_id},
            actions=[
                TraceAction(type="analyze_events_agg", details={"events_agg": e.model_dump()}),
                TraceAction(type="produce_suggestions", details={"suggestion": suggestion}),
            ],
            metrics={"confidence": float(min(1.0, confidence)), "signal": float(signal)},
            warnings=[],
        )

        return UserResult(suggestion_dict=suggestion, confidence=float(min(1.0, confidence)), trace=trace)
