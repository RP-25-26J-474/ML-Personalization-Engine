from __future__ import annotations
from app.core.schemas.profile import PROFILE_PASSTHROUGH_FIELDS, ProfileDiff


def _diffable(profile: dict | None) -> dict | None:
    if profile is None:
        return None
    return {
        key: value
        for key, value in profile.items()
        if key not in PROFILE_PASSTHROUGH_FIELDS
    }


def diff_profiles(old: dict | None, new: dict) -> ProfileDiff:
    old = _diffable(old)
    new = _diffable(new) or {}

    if old is None:
        return ProfileDiff(changed=list(new.keys()), old=None, new=new)

    changed = []
    for k, v in new.items():
        if old.get(k) != v:
            changed.append(k)

    return ProfileDiff(changed=changed, old=old, new=new)
