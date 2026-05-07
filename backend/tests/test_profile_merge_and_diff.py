from __future__ import annotations

from app.core.engine.constraints.clamp import clamp_profile_dict
from app.core.engine.merge.diff import diff_profiles
from app.core.engine.merge.merge_policy import merge_profiles


BASE_PROFILE = {
    "font_size": 16,
    "line_height": 1.5,
    "contrast_mode": "normal",
    "primary_color": "#1a73e8",
    "primary_color_content": "#ffffff",
    "secondary_color": "#34a853",
    "secondary_color_content": "#ffffff",
    "accent_color": "#fbbc04",
    "accent_color_content": "#000000",
    "theme": "light",
    "element_spacing_x": 6,
    "element_spacing_y": 4,
    "element_padding_x": 8,
    "element_padding_y": 8,
    "reduced_motion": False,
    "target_size": 32,
    "tooltip_assist": False,
    "layout_simplification": False,
}


def test_clamp_profile_dict_applies_safety_bounds_and_preserves_unknown_fields():
    profile = {
        "font_size": 99,
        "line_height": 1.234,
        "target_size": 5,
        "primary_color": "#123456",
    }

    clamped = clamp_profile_dict(profile)

    assert clamped["font_size"] == 24
    assert clamped["line_height"] == 1.23
    assert clamped["target_size"] == 20
    assert clamped["primary_color"] == "#123456"


def test_merge_profiles_overlays_user_suggestion_then_clamps():
    merged = merge_profiles(
        BASE_PROFILE,
        {
            "font_size": 30,
            "target_size": 60,
            "tooltip_assist": True,
        },
    )

    assert merged["font_size"] == 24
    assert merged["target_size"] == 48
    assert merged["tooltip_assist"] is True
    assert merged["theme"] == BASE_PROFILE["theme"]


def test_diff_profiles_marks_all_fields_changed_for_first_version():
    diff = diff_profiles(None, BASE_PROFILE)

    assert diff.changed == list(BASE_PROFILE.keys())
    assert diff.old is None
    assert diff.new == BASE_PROFILE


def test_diff_profiles_reports_only_changed_new_profile_fields():
    old = dict(BASE_PROFILE)
    new = dict(BASE_PROFILE, font_size=18, tooltip_assist=True)

    diff = diff_profiles(old, new)

    assert diff.changed == ["font_size", "tooltip_assist"]
    assert diff.old == old
    assert diff.new == new
