from __future__ import annotations

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from app.core.config import settings


class DB:
    def __init__(self) -> None:
        self._client = MongoClient(settings.MONGODB_URI)
        self._db: Database = self._client[settings.MONGODB_DB_NAME]

    def collection(self, name: str) -> Collection:
        return self._db[name]


db = DB()
