from __future__ import annotations
from dataclasses import asdict, dataclass
from typing import List
import math

from app.core.storage.db import db


@dataclass
class BaselineState:
    count: int
    mean: List[float]
    m2: List[float]


class TempBaselineRepo:
    def __init__(self) -> None:
        self._col = db.collection("temp_baselines")
        self._col.create_index([("user_id", 1)], unique=True)

    def update(self, user_id: str, features: list[float]) -> None:
        doc = self._col.find_one({"user_id": user_id})
        if doc is None:
            state = BaselineState(
                count=1,
                mean=list(features),
                m2=[0.0 for _ in features],
            )
            row = asdict(state)
            row["user_id"] = user_id
            self._col.insert_one(row)
            return

        mean = list(doc.get("mean", []))
        # Backward compatible with older rows that only had mean/count.
        m2 = list(doc.get("m2", [0.0 for _ in mean]))
        if len(m2) != len(mean):
            m2 = [0.0 for _ in mean]

        state = BaselineState(count=int(doc["count"]), mean=mean, m2=m2)
        state.count += 1
        n = float(state.count)
        new_mean: list[float] = []
        new_m2: list[float] = []
        for prev_mean, prev_m2, x in zip(state.mean, state.m2, features):
            delta = x - prev_mean
            mean_i = prev_mean + (delta / n)
            delta2 = x - mean_i
            m2_i = prev_m2 + (delta * delta2)
            new_mean.append(mean_i)
            new_m2.append(m2_i)
        state.mean = new_mean
        state.m2 = new_m2
        self._col.update_one(
            {"user_id": user_id},
            {"$set": {"count": state.count, "mean": state.mean, "m2": state.m2}},
            upsert=True,
        )

    def get(self, user_id: str) -> list[float] | None:
        doc = self._col.find_one({"user_id": user_id})
        if doc is None:
            return None
        return list(doc.get("mean", []))

    def stats(self) -> dict:
        users = int(self._col.count_documents({}))
        pipeline = [{"$group": {"_id": None, "total_samples": {"$sum": "$count"}}}]
        grouped = list(self._col.aggregate(pipeline))
        total_samples = int(grouped[0].get("total_samples", 0)) if grouped else 0
        return {"users": users, "total_samples": total_samples}

    def get_template(self, user_id: str) -> dict | None:
        doc = self._col.find_one({"user_id": user_id})
        if doc is None:
            return None
        count = int(doc.get("count", 0))
        mean = list(doc.get("mean", []))
        m2 = list(doc.get("m2", [0.0 for _ in mean]))
        if len(m2) != len(mean):
            m2 = [0.0 for _ in mean]

        variance = []
        std = []
        denom = max(1, count - 1)
        for m2_i in m2:
            var_i = float(m2_i) / float(denom)
            var_i = max(0.0, var_i)
            variance.append(var_i)
            std.append(math.sqrt(var_i))

        return {
            "user_id": user_id,
            "count": count,
            "mean": mean,
            "variance": variance,
            "std": std,
            "updated_at": str(doc.get("_id").generation_time) if doc.get("_id") else None,
        }

    def list_templates(self, user_id: str | None = None) -> list[dict]:
        query = {"user_id": user_id} if user_id else {}
        templates: list[dict] = []
        for doc in self._col.find(query).sort([("user_id", 1)]):
            template = self.get_template(str(doc.get("user_id", "")))
            if template is not None:
                templates.append(template)
        return templates

    def set_template(self, user_id: str, count: int, mean: list[float], m2: list[float]) -> None:
        self._col.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "user_id": user_id,
                    "count": int(count),
                    "mean": list(mean),
                    "m2": list(m2),
                }
            },
            upsert=True,
        )
