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
            {"_id": "category_model_version"},
            {"$setOnInsert": {"value": "v0"}},
            upsert=True,
        )
        self._col.update_one(
            {"_id": "user_seq_model_version"},
            {"$setOnInsert": {"value": "v0"}},
            upsert=True,
        )
        self._col.update_one(
            {"_id": "global_iforest_last_trained_at"},
            {"$setOnInsert": {"value": None}},
            upsert=True,
        )
        self._col.update_one(
            {"_id": "category_last_n_samples"},
            {"$setOnInsert": {"value": 0}},
            upsert=True,
        )
        self._col.update_one(
            {"_id": "category_last_trained_at"},
            {"$setOnInsert": {"value": None}},
            upsert=True,
        )
        self._col.update_one(
            {"_id": "user_seq_n_clusters"},
            {"$setOnInsert": {"value": None}},
            upsert=True,
        )
        self._col.update_one(
            {"_id": "user_seq_embedding_dim"},
            {"$setOnInsert": {"value": None}},
            upsert=True,
        )
        self._col.update_one(
            {"_id": "user_seq_last_trained_at"},
            {"$setOnInsert": {"value": None}},
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

    def _get_optional_value(self, key: str) -> str | None:
        doc = self._col.find_one({"_id": key})
        if doc is None:
            return None
        value = doc.get("value")
        if value is None:
            return None
        return str(value)

    def _set_optional_value(self, key: str, value: str | None) -> None:
        self._col.update_one({"_id": key}, {"$set": {"value": value}}, upsert=True)

    def _get_int_value(self, key: str, default: int = 0) -> int:
        doc = self._col.find_one({"_id": key})
        if doc is None:
            self._col.update_one({"_id": key}, {"$set": {"value": default}}, upsert=True)
            return default
        try:
            return int(doc.get("value", default))
        except (TypeError, ValueError):
            return default

    def _set_int_value(self, key: str, value: int) -> None:
        self._col.update_one({"_id": key}, {"$set": {"value": int(value)}}, upsert=True)

    def _get_optional_int_value(self, key: str) -> int | None:
        doc = self._col.find_one({"_id": key})
        if doc is None:
            return None
        raw = doc.get("value")
        if raw is None:
            return None
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None

    def _set_optional_int_value(self, key: str, value: int | None) -> None:
        self._col.update_one({"_id": key}, {"$set": {"value": value}}, upsert=True)

    @property
    def global_iforest_version(self) -> str:
        return self._get_value("global_iforest_version")

    @global_iforest_version.setter
    def global_iforest_version(self, version: str) -> None:
        self._set_value("global_iforest_version", version)

    @property
    def global_iforest_last_trained_at(self) -> str | None:
        return self._get_optional_value("global_iforest_last_trained_at")

    @global_iforest_last_trained_at.setter
    def global_iforest_last_trained_at(self, trained_at: str | None) -> None:
        self._set_optional_value("global_iforest_last_trained_at", trained_at)

    @property
    def category_model_version(self) -> str:
        return self._get_value("category_model_version")

    @category_model_version.setter
    def category_model_version(self, version: str) -> None:
        self._set_value("category_model_version", version)

    @property
    def category_last_n_samples(self) -> int:
        return self._get_int_value("category_last_n_samples", default=0)

    @category_last_n_samples.setter
    def category_last_n_samples(self, n_samples: int) -> None:
        self._set_int_value("category_last_n_samples", n_samples)

    @property
    def category_last_trained_at(self) -> str | None:
        return self._get_optional_value("category_last_trained_at")

    @category_last_trained_at.setter
    def category_last_trained_at(self, trained_at: str | None) -> None:
        self._set_optional_value("category_last_trained_at", trained_at)

    @property
    def user_seq_model_version(self) -> str:
        return self._get_value("user_seq_model_version")

    @user_seq_model_version.setter
    def user_seq_model_version(self, version: str) -> None:
        self._set_value("user_seq_model_version", version)

    @property
    def user_seq_n_clusters(self) -> int | None:
        return self._get_optional_int_value("user_seq_n_clusters")

    @user_seq_n_clusters.setter
    def user_seq_n_clusters(self, n_clusters: int | None) -> None:
        self._set_optional_int_value("user_seq_n_clusters", n_clusters)

    @property
    def user_seq_embedding_dim(self) -> int | None:
        return self._get_optional_int_value("user_seq_embedding_dim")

    @user_seq_embedding_dim.setter
    def user_seq_embedding_dim(self, embedding_dim: int | None) -> None:
        self._set_optional_int_value("user_seq_embedding_dim", embedding_dim)

    @property
    def user_seq_last_trained_at(self) -> str | None:
        return self._get_optional_value("user_seq_last_trained_at")

    @user_seq_last_trained_at.setter
    def user_seq_last_trained_at(self, trained_at: str | None) -> None:
        self._set_optional_value("user_seq_last_trained_at", trained_at)

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
