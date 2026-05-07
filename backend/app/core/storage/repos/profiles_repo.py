from __future__ import annotations

from app.core.schemas.profile import PROFILE_PASSTHROUGH_FIELDS, PersonalizationProfile
from app.core.storage.db import db


class ProfilesRepo:
    def __init__(self) -> None:
        self._col = db.collection("profiles")
        self._current_col = db.collection("current_profile")
        self._col.create_index([("user_id", 1), ("metadata.version", 1)], unique=True)
        self._col.create_index([("user_id", 1), ("metadata.created_at", -1)])
        self._current_col.create_index([("user_id", 1)], unique=True)

    def get_latest(self, user_id: str) -> PersonalizationProfile | None:
        # Authoritative latest source is history by version/time.
        doc = self._col.find_one(
            {"user_id": user_id},
            sort=[("metadata.version", -1), ("metadata.created_at", -1)],
        )
        if doc is not None:
            doc.pop("_id", None)
            return PersonalizationProfile.model_validate(doc)

        current_doc = self.get_current(user_id)
        if current_doc is None:
            return None
        return PersonalizationProfile.model_validate(current_doc)

    def get_current(self, user_id: str) -> dict | None:
        current_doc = self._current_col.find_one({"user_id": user_id})
        if current_doc is None:
            return None

        current_doc.pop("_id", None)
        current_doc["profile_changes"] = self._normalize_profile_changes(
            current_doc.get("profile_changes")
        )
        return current_doc

    def save_version(self, profile: PersonalizationProfile) -> None:
        prev_current = self._current_col.find_one({"user_id": profile.user_id})
        prev_profile = prev_current.get("profile") if prev_current else None

        history_doc = profile.model_dump()
        history_doc.pop("_id", None)

        # Idempotent history write to avoid duplicate-key failures on retries.
        self._col.replace_one(
            {
                "user_id": profile.user_id,
                "metadata.version": profile.metadata.version,
            },
            history_doc,
            upsert=True,
        )

        current_doc = dict(history_doc)
        current_doc["profile_changes"] = self._build_profile_changes(
            prev_profile=prev_profile,
            new_profile=current_doc.get("profile", {}),
        )
        current_doc.pop("_id", None)
        current_doc.pop("user_id", None)
        self._current_col.update_one(
            {"user_id": profile.user_id},
            {"$set": current_doc, "$setOnInsert": {"user_id": profile.user_id}},
            upsert=True,
        )

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

    def count_versions_by_user(self) -> dict[str, int]:
        rows = self._col.aggregate(
            [
                {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
                {"$sort": {"count": -1, "_id": 1}},
            ]
        )
        return {str(row["_id"]): int(row["count"]) for row in rows}

    @staticmethod
    def _build_profile_changes(prev_profile: dict | None, new_profile: dict) -> dict:
        if not prev_profile:
            return {"changed": [], "new": {}, "old": {}}

        changed = [
            key for key, new_value in new_profile.items()
            if key not in PROFILE_PASSTHROUGH_FIELDS and prev_profile.get(key) != new_value
        ]
        return {
            "changed": changed,
            "new": {key: new_profile.get(key) for key in changed},
            "old": {key: prev_profile.get(key) for key in changed},
        }

    @staticmethod
    def _normalize_profile_changes(profile_changes: dict | None) -> dict:
        if not profile_changes:
            return {"changed": [], "new": {}, "old": {}}
        return {
            "changed": profile_changes.get("changed") or [],
            "new": profile_changes.get("new") or {},
            "old": profile_changes.get("old") or {},
        }
