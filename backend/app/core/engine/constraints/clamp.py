from __future__ import annotations
from dataclasses import asdict
from typing import Any, Dict, Tuple

from app.core.engine.constraints.safety_bounds import SAFETY_BOUNDS


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


def clamp_profile_dict(profile: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(profile)
    for k, bounds in SAFETY_BOUNDS.items():
        if k in out:
            out[k] = _clamp_num(out[k], bounds)
    return out
