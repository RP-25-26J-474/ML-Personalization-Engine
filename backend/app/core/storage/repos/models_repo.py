from __future__ import annotations

from app.core.storage.db import db


class ModelsRepo:
    def __init__(self) -> None:
        self._col = db.collection("model_versions")
        self._ensure_defaults()

    def _ensure_defaults(self) -> None:
        self._col.update_one(
            {"_id": "global_iforest_version"},
            {"$setOnInsert": {"value": "v0"}},
            upsert=True,
        )
        self._col.update_one(
            {"_id": "user_seq_model_version"},
            {"$setOnInsert": {"value": "v0"}},
            upsert=True,
        )

    def _get_value(self, key: str, default: str = "v0") -> str:
        doc = self._col.find_one({"_id": key})
        if doc is None:
            self._col.update_one(
                {"_id": key},
                {"$set": {"value": default}},
                upsert=True,
            )
            return default
        return str(doc.get("value", default))

    def _set_value(self, key: str, value: str) -> None:
        self._col.update_one({"_id": key}, {"$set": {"value": value}}, upsert=True)

    @property
    def global_iforest_version(self) -> str:
        return self._get_value("global_iforest_version")

    @global_iforest_version.setter
    def global_iforest_version(self, version: str) -> None:
        self._set_value("global_iforest_version", version)

    @property
    def user_seq_model_version(self) -> str:
        return self._get_value("user_seq_model_version")

    @user_seq_model_version.setter
    def user_seq_model_version(self, version: str) -> None:
        self._set_value("user_seq_model_version", version)

    @property
    def user_model_versions(self) -> dict[str, str]:
        docs = self._col.find({"_id": {"$regex": r"^user_model_version:"}})
        out: dict[str, str] = {}
        for doc in docs:
            user_id = str(doc["_id"]).split(":", 1)[1]
            out[user_id] = str(doc.get("value", "v0"))
        return out

    def set_user_model_version(self, user_id: str, version: str) -> None:
        self._set_value(f"user_model_version:{user_id}", version)

    def get_user_model_version(self, user_id: str) -> str | None:
        doc = self._col.find_one({"_id": f"user_model_version:{user_id}"})
        if doc is None:
            return None
        return str(doc.get("value", "v0"))
