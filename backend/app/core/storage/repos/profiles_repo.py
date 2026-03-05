from __future__ import annotations

from app.core.schemas.profile import PersonalizationProfile
from app.core.storage.db import db


class ProfilesRepo:
    def __init__(self) -> None:
        self._col = db.collection("profiles")
        self._col.create_index([("user_id", 1), ("metadata.version", 1)], unique=True)
        self._col.create_index([("user_id", 1), ("metadata.created_at", -1)])

    def get_latest(self, user_id: str) -> PersonalizationProfile | None:
        doc = self._col.find_one(
            {"user_id": user_id},
            sort=[("metadata.version", -1), ("metadata.created_at", -1)],
        )
        if doc is None:
            return None
        doc.pop("_id", None)
        return PersonalizationProfile.model_validate(doc)

    def save_version(self, profile: PersonalizationProfile) -> None:
        self._col.insert_one(profile.model_dump())

    def list_versions(self, user_id: str) -> list[PersonalizationProfile]:
        docs = self._col.find({"user_id": user_id}).sort(
            [("metadata.version", 1), ("metadata.created_at", 1)]
        )
        out: list[PersonalizationProfile] = []
        for doc in docs:
            doc.pop("_id", None)
            out.append(PersonalizationProfile.model_validate(doc))
        return out

    def count_users(self) -> int:
        return len(self._col.distinct("user_id"))

    def count_versions(self) -> int:
        return self._col.count_documents({})
