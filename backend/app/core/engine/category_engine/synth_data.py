from __future__ import annotations
import random
from typing import Dict, Any


def synthetic_category_profile(seed: int, vision_weight: float, motor_weight: float, literacy_weight: float) -> Dict[str, Any]:
    """
    Generate a plausible baseline profile.
    This is intentionally simple & explainable for the GUI demo.
    """
    rnd = random.Random(seed)

    # Simple mappings:
    font_size = int(round(11 + 6 * vision_weight + 2 * literacy_weight))
    target_size = int(round(24 + 10 * motor_weight + 4 * vision_weight))
    line_height = round(1.4 + 0.4 * literacy_weight + 0.2 * vision_weight, 2)

    reduced_motion = motor_weight > 0.35
    tooltip_assist = literacy_weight > 0.35
    layout_simplification = literacy_weight > 0.60

    contrast_mode = "high" if vision_weight > 0.30 else "normal"
    theme = "dark" if vision_weight > 0.40 else "light"

    # keep your colors stable for now
    primary = "#1a73e8"
    accent = "#e37400"
    content = "#ffffff"

    return {
        "font_size": font_size,
        "line_height": line_height,
        "contrast_mode": contrast_mode,
        "primary_color": primary,
        "primary_color_content": content,
        "secondary_color": primary,
        "secondary_color_content": content,
        "accent_color": accent,
        "accent_color_content": content,
        "theme": theme,
        "element_spacing_x": int(round(4 + 6 * vision_weight)),
        "element_spacing_y": int(round(2 + 4 * vision_weight)),
        "element_padding_x": 8,
        "element_padding_y": 8,
        "reduced_motion": reduced_motion,
        "target_size": target_size,
        "tooltip_assist": tooltip_assist,
        "layout_simplification": layout_simplification,
    }
