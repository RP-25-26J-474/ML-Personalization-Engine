from __future__ import annotations
from typing import Dict, Any

from app.core.engine.constraints.clamp import clamp_profile_dict
from app.core.schemas.profile import PROFILE_PASSTHROUGH_FIELDS


def merge_profiles(category_base: Dict[str, Any], user_suggestion: Dict[str, Any] | None) -> Dict[str, Any]:
    """
    Priority (for now, since user-preferences are handled elsewhere):
      - start with category base
      - overlay user suggestion
      - clamp to safety bounds
    """
    merged = dict(category_base)
    if user_suggestion:
        merged.update(
            {
                key: value
                for key, value in user_suggestion.items()
                if key not in PROFILE_PASSTHROUGH_FIELDS
            }
        )
    return clamp_profile_dict(merged)
