from __future__ import annotations
import random


def make_synth_survey_row(rnd: random.Random):
    # 6D impairment vector
    vision_loss = rnd.random()
    color_blindness = rnd.random() * 0.6
    delayed_reaction = rnd.random() * 0.6
    inaccurate_click = rnd.random() * 0.6
    motor_impairment = rnd.random() * 0.6
    literacy = rnd.random()

    # Convert raw needs into plausible knob preferences
    vision_weight = (vision_loss + color_blindness) / 2.0
    motor_weight = (delayed_reaction + inaccurate_click + motor_impairment) / 3.0

    font_size = int(round(11 + 7 * vision_weight + 2 * literacy))
    target_size = int(round(24 + 10 * motor_weight + 5 * vision_weight))
    line_height = round(1.4 + 0.35 * literacy + 0.25 * vision_weight, 2)

    tooltip_assist = literacy > 0.45
    reduced_motion = motor_weight > 0.35
    contrast_mode = "high" if vision_weight > 0.30 else "normal"
    theme = "dark" if vision_weight > 0.40 else "light"

    profile = {
        "font_size": font_size,
        "line_height": line_height,
        "contrast_mode": contrast_mode,
        "primary_color": "#1a73e8",
        "primary_color_content": "#ffffff",
        "secondary_color": "#1a73e8",
        "secondary_color_content": "#ffffff",
        "accent_color": "#e37400",
        "accent_color_content": "#ffffff",
        "theme": theme,
        "element_spacing_x": int(round(4 + 8 * vision_weight)),
        "element_spacing_y": int(round(2 + 5 * vision_weight)),
        "element_padding_x": 8,
        "element_padding_y": 8,
        "reduced_motion": reduced_motion,
        "target_size": target_size,
        "tooltip_assist": tooltip_assist,
        "layout_simplification": literacy > 0.65,
    }

    features = {
        "vision_loss": vision_loss,
        "color_blindness": color_blindness,
        "delayed_reaction": delayed_reaction,
        "inaccurate_click": inaccurate_click,
        "motor_impairment": motor_impairment,
        "literacy": literacy,
    }
    return features, profile


def generate_synth_survey(n: int = 400, seed: int = 42):
    rnd = random.Random(seed)
    rows = [make_synth_survey_row(rnd) for _ in range(n)]
    Xdicts = [r[0] for r in rows]
    profiles = [r[1] for r in rows]
    return Xdicts, profiles
