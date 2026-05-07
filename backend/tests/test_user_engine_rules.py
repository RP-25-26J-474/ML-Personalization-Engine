from __future__ import annotations

import pytest

from app.core.engine.user_engine.rules import compute_confidence, compute_signals, suggest_from_agg


def test_compute_signals_combines_error_zoom_and_hesitation():
    signals = compute_signals(
        {
            "misclick_rate": 0.2,
            "rage_clicks": 2,
            "zoom_events": 2,
            "avg_click_interval_ms": 1200,
            "avg_dwell_ms": 3000,
        }
    )

    assert signals["error_signal"] == pytest.approx(0.74)
    assert signals["zoom_signal"] == pytest.approx(0.5)
    assert signals["hesitation_signal"] == 1.0
    assert signals["combined_signal"] == pytest.approx(0.719)


def test_suggest_from_agg_generates_accessibility_adjustments():
    suggestion = suggest_from_agg(
        {
            "misclick_rate": 0.2,
            "rage_clicks": 2,
            "zoom_events": 3,
            "avg_click_interval_ms": 1200,
            "avg_dwell_ms": 3000,
        }
    )

    assert suggestion["target_size"] == 39
    assert suggestion["element_spacing_x"] == 8
    assert suggestion["element_spacing_y"] == 5
    assert suggestion["font_size"] == 18
    assert suggestion["tooltip_assist"] is True


def test_compute_confidence_caps_at_one():
    assert compute_confidence({"combined_signal": 10.0}) == 1.0
