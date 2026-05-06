from __future__ import annotations
import re
from typing import Any, Dict, Tuple

from app.core.engine.constraints.safety_bounds import SAFETY_BOUNDS

BOOL_FIELDS = {"reduced_motion", "tooltip_assist", "layout_simplification"}
ENUM_FIELDS = {
    "contrast_mode": {"normal", "high"},
    "theme": {"light", "dark"},
}
COLOR_FIELDS = {
    "primary_color",
    "primary_color_content",
    "secondary_color",
    "secondary_color_content",
    "accent_color",
    "accent_color_content",
}
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _clamp_num(val: Any, bounds: Tuple[float, float]) -> Any:
    try:
        x = float(val)
    except Exception:
        return val
    lo, hi = bounds
    if x < lo:
        return lo
    if x > hi:
        return hi
    # keep int fields as int
    if isinstance(val, int):
        return int(round(x))
    return x


def _coerce_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        normalized = val.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    return bool(val)


def clamp_profile_dict(profile: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(profile)
    for k, bounds in SAFETY_BOUNDS.items():
        if k in out:
            out[k] = _clamp_num(out[k], bounds)
    if "line_height" in out:
        try:
            out["line_height"] = round(float(out["line_height"]), 2)
        except Exception:
            out.pop("line_height")
    for k in BOOL_FIELDS:
        if k in out:
            out[k] = _coerce_bool(out[k])
    for k, allowed_values in ENUM_FIELDS.items():
        if k in out:
            normalized = str(out[k]).strip().lower()
            if normalized in allowed_values:
                out[k] = normalized
            else:
                out.pop(k)
    for k in COLOR_FIELDS:
        if k in out:
            normalized = out[k].strip() if isinstance(out[k], str) else ""
            if HEX_COLOR_RE.match(normalized):
                out[k] = normalized
            else:
                out.pop(k)
    return out
