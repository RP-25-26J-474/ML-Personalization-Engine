# Per-impairment/category ranges aligned with the WCAG 2.2 token map.
# These ranges are tighter than SAFETY_BOUNDS when a category has stronger needs.
CATEGORY_MINMAX = {
    "default": {
        "font_size": (12, 24),
        "line_height": (1.4, 1.8),
        "target_size": (24, 44),
        "element_spacing_x": (0, 24),
        "element_spacing_y": (0, 24),
        "element_padding_x": (0, 32),
        "element_padding_y": (0, 24),
    },
    "low_vision": {
        "font_size": (16, 32),
        "line_height": (1.5, 2.2),
        "target_size": (44, 64),
        "element_spacing_x": (8, 24),
        "element_spacing_y": (6, 24),
        "element_padding_x": (12, 32),
        "element_padding_y": (10, 24),
    },
    "color_vision": {
        "font_size": (14, 28),
        "line_height": (1.4, 2.0),
        "target_size": (24, 56),
        "element_spacing_x": (4, 24),
        "element_spacing_y": (4, 24),
        "element_padding_x": (8, 32),
        "element_padding_y": (8, 24),
    },
    "motor_impairment": {
        "font_size": (14, 28),
        "line_height": (1.4, 2.0),
        "target_size": (44, 64),
        "element_spacing_x": (8, 24),
        "element_spacing_y": (6, 24),
        "element_padding_x": (12, 32),
        "element_padding_y": (10, 24),
    },
    "low_literacy": {
        "font_size": (16, 28),
        "line_height": (1.5, 2.2),
        "target_size": (36, 56),
        "element_spacing_x": (8, 24),
        "element_spacing_y": (6, 24),
        "element_padding_x": (12, 32),
        "element_padding_y": (10, 24),
    },
}
