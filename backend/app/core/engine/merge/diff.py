from __future__ import annotations
from app.core.schemas.profile import ProfileDiff


def diff_profiles(old: dict | None, new: dict) -> ProfileDiff:
    if old is None:
        return ProfileDiff(changed=list(new.keys()), old=None, new=new)

    changed = []
    for k, v in new.items():
        if old.get(k) != v:
            changed.append(k)

    return ProfileDiff(changed=changed, old=old, new=new)
