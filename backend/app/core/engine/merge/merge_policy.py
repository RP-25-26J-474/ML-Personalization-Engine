from __future__ import annotations
from typing import Dict, Any

from app.core.engine.constraints.clamp import clamp_profile_dict


def merge_profiles(category_base: Dict[str, Any], user_suggestion: Dict[str, Any] | None) -> Dict[str, Any]:
    """
    Priority (for now, since user-preferences are handled elsewhere):
      - start with category base
      - overlay user suggestion
      - clamp to safety bounds
    """
    merged = dict(category_base)
    if user_suggestion:
        merged.update(user_suggestion)
    return clamp_profile_dict(merged)
