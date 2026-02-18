from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from app.core.schemas.profile import PersonalizationProfile


@dataclass
class ProfilesRepo:
    # user_id -> list of versions (append-only)
    _profiles: Dict[str, List[PersonalizationProfile]] = field(default_factory=dict)

    def get_latest(self, user_id: str) -> Optional[PersonalizationProfile]:
        arr = self._profiles.get(user_id, [])
        return arr[-1] if arr else None

    def save_version(self, profile: PersonalizationProfile) -> None:
        self._profiles.setdefault(profile.user_id, []).append(profile)

    def list_versions(self, user_id: str) -> List[PersonalizationProfile]:
        return list(self._profiles.get(user_id, []))
