from __future__ import annotations

from typing import Any, Dict

TARGET_SIZE_MIN = 24
TARGET_SIZE_ENHANCED = 44


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _lerp(lo: float, hi: float, t: float) -> float:
    return lo + (hi - lo) * t


def compute_signals(agg: Dict[str, float]) -> Dict[str, float]:
    misclick_rate = agg["misclick_rate"]
    rage_clicks = agg["rage_clicks"]
    zoom_events = agg["zoom_events"]
    avg_click_interval_ms = agg["avg_click_interval_ms"]
    avg_dwell_ms = agg["avg_dwell_ms"]

    error_signal = _clamp(misclick_rate * 2.5 + 0.12 * rage_clicks, 0.0, 1.0)
    zoom_signal = _clamp(zoom_events / 4.0, 0.0, 1.0)
    hesitation_signal = 1.0 if (
        avg_click_interval_ms >= 1000 and avg_dwell_ms >= 2500
    ) else 0.0

    combined_signal = _clamp(
        0.60 * error_signal + 0.25 * zoom_signal + 0.15 * hesitation_signal,
        0.0,
        1.0,
    )

    return {
        "error_signal": float(error_signal),
        "zoom_signal": float(zoom_signal),
        "hesitation_signal": float(hesitation_signal),
        "combined_signal": float(combined_signal),
    }


def compute_confidence(signals: Dict[str, float]) -> float:
    return float(min(1.0, 0.65 + 0.30 * signals["combined_signal"]))


def suggest_from_agg(agg: Dict[str, float]) -> Dict[str, Any]:
    signals = compute_signals(agg)
    suggestion: Dict[str, Any] = {}

    error_signal = signals["error_signal"]
    if error_signal > 0.0:
        suggestion["target_size"] = int(
            round(_lerp(TARGET_SIZE_MIN, TARGET_SIZE_ENHANCED, error_signal))
        )
        suggestion["element_spacing_x"] = int(round(_lerp(4.0, 10.0, error_signal)))
        suggestion["element_spacing_y"] = int(round(_lerp(2.0, 6.0, error_signal)))

    if agg["zoom_events"] >= 2:
        zoom_signal = signals["zoom_signal"]
        suggestion["font_size"] = int(round(_lerp(16.0, 18.0, zoom_signal)))

    if signals["hesitation_signal"] > 0.0:
        suggestion["tooltip_assist"] = True

    return suggestion
