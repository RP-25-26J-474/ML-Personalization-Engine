from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.engine.temp_user_detector.features import FEATURE_ORDER, extract_features
from app.core.engine.user_engine.features import extract_user_features
from app.core.schemas.interactions import EventsAgg, InteractionBatch
from app.core.schemas.profile import ProfileKnobs


def make_batch(**event_overrides) -> InteractionBatch:
    events = {
        "click_count": 12,
        "misclick_rate": 0.25,
        "avg_click_interval_ms": 450.0,
        "avg_dwell_ms": 1200.0,
        "rage_clicks": 2,
        "zoom_events": 1,
        "scroll_speed_px_s": 300.0,
    }
    events.update(event_overrides)
    return InteractionBatch(
        user_id="user-1",
        batch_id="batch-1",
        captured_at="2026-05-07T10:00:00+00:00",
        events_agg=EventsAgg(**events),
    )


def test_interaction_batch_rejects_invalid_rates():
    with pytest.raises(ValidationError):
        make_batch(misclick_rate=1.5)


def test_profile_knobs_enforce_numeric_bounds():
    with pytest.raises(ValidationError):
        ProfileKnobs(
            font_size=7,
            line_height=1.5,
            contrast_mode="normal",
            primary_color="#000000",
            primary_color_content="#ffffff",
            secondary_color="#000000",
            secondary_color_content="#ffffff",
            accent_color="#000000",
            accent_color_content="#ffffff",
            theme="light",
            element_spacing_x=1,
            element_spacing_y=1,
            element_padding_x=1,
            element_padding_y=1,
            reduced_motion=False,
            target_size=32,
            tooltip_assist=False,
            layout_simplification=False,
        )


def test_temp_detector_extract_features_uses_documented_order():
    batch = make_batch()

    features = extract_features(batch)

    assert FEATURE_ORDER == [
        "click_count",
        "misclick_rate",
        "avg_click_interval_ms",
        "avg_dwell_ms",
        "rage_clicks",
        "zoom_events",
        "scroll_speed_px_s",
    ]
    assert features.tolist() == [12.0, 0.25, 450.0, 1200.0, 2.0, 1.0, 300.0]


def test_user_engine_feature_extraction_matches_user_model_order():
    batch = make_batch()

    features = extract_user_features(batch)

    assert features.tolist() == [0.25, 450.0, 1200.0, 2.0, 1.0]
