from __future__ import annotations
from dataclasses import asdict, dataclass
from typing import List

from app.core.storage.db import db


@dataclass
class BaselineState:
    count: int
    mean: List[float]


class TempBaselineRepo:
    def __init__(self) -> None:
        self._col = db.collection("temp_baselines")
        self._col.create_index([("user_id", 1)], unique=True)

    def update(self, user_id: str, features: list[float]) -> None:
        doc = self._col.find_one({"user_id": user_id})
        if doc is None:
            state = BaselineState(count=1, mean=list(features))
            row = asdict(state)
            row["user_id"] = user_id
            self._col.insert_one(row)
            return

        state = BaselineState(count=int(doc["count"]), mean=list(doc["mean"]))
        state.count += 1
        n = float(state.count)
        state.mean = [
            (prev * (n - 1) + new) / n for prev, new in zip(state.mean, features)
        ]
        self._col.update_one(
            {"user_id": user_id},
            {"$set": {"count": state.count, "mean": state.mean}},
            upsert=True,
        )

    def get(self, user_id: str) -> list[float] | None:
        doc = self._col.find_one({"user_id": user_id})
        if doc is None:
            return None
        return list(doc.get("mean", []))

    def stats(self) -> dict:
        return {"users": self._col.count_documents({})}
