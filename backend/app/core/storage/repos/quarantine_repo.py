from __future__ import annotations
from dataclasses import asdict, dataclass
from typing import Any, Dict, List

from app.core.storage.db import db


@dataclass
class QuarantineRow:
    user_id: str
    batch_id: str
    reason: str
    anomaly_score: float
    payload: Dict[str, Any]


class QuarantineRepo:
    def __init__(self) -> None:
        self._col = db.collection("quarantine")
        self._col.create_index([("user_id", 1), ("batch_id", 1)])

    def add(self, row: QuarantineRow) -> None:
        self._col.insert_one(asdict(row))

    def add_many(self, rows: list[QuarantineRow]) -> None:
        if not rows:
            return
        self._col.insert_many([asdict(row) for row in rows], ordered=False)

    def list(self, user_id: str) -> list[QuarantineRow]:
        docs = self._col.find({"user_id": user_id})
        out: list[QuarantineRow] = []
        for doc in docs:
            doc.pop("_id", None)
            out.append(QuarantineRow(**doc))
        return out
