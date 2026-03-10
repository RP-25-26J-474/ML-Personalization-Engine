from __future__ import annotations
from dataclasses import asdict, dataclass
from typing import Any, Dict

from app.core.storage.db import db


@dataclass
class TempBatchRecord:
    user_id: str
    batch_id: str
    captured_at: str
    outcome: str
    anomaly_score: float
    similarity_score: float
    heuristic_components: Dict[str, float]
    features: list[float]
    payload: Dict[str, Any]


class TempBatchesRepo:
    def __init__(self) -> None:
        self._col = db.collection("temp_batches")
        self._col.create_index([("user_id", 1), ("batch_id", 1)])
        self._col.create_index([("user_id", 1), ("captured_at", 1)])

    def add(self, row: TempBatchRecord) -> None:
        self._col.insert_one(asdict(row))

    def add_many(self, rows: list[TempBatchRecord]) -> None:
        if not rows:
            return
        self._col.insert_many([asdict(row) for row in rows], ordered=False)

    def list(self, user_id: str) -> list[TempBatchRecord]:
        docs = self._col.find({"user_id": user_id}).sort([("captured_at", 1)])
        out: list[TempBatchRecord] = []
        for doc in docs:
            doc.pop("_id", None)
            out.append(TempBatchRecord(**doc))
        return out

    def list_all(self) -> list[TempBatchRecord]:
        docs = self._col.find({}).sort([("captured_at", 1)])
        out: list[TempBatchRecord] = []
        for doc in docs:
            doc.pop("_id", None)
            out.append(TempBatchRecord(**doc))
        return out

    def stats(self) -> dict:
        counts = {"keep": 0, "quarantine": 0, "reject": 0}
        pipeline = [
            {"$group": {"_id": "$outcome", "count": {"$sum": 1}}},
        ]
        grouped = list(self._col.aggregate(pipeline))
        total = 0
        for row in grouped:
            key = str(row.get("_id"))
            count = int(row.get("count", 0))
            total += count
            if key in counts:
                counts[key] = count
        return {
            "total": total,
            "kept": counts["keep"],
            "quarantined": counts["quarantine"],
            "rejected": counts["reject"],
            "user_count": len(self._col.distinct("user_id")),
        }
