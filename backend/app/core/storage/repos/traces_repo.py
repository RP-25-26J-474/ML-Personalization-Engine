from __future__ import annotations

from app.core.schemas.trace import DecisionTrace
from app.core.storage.db import db


class TracesRepo:
    def __init__(self) -> None:
        self._col = db.collection("traces")
        self._col.create_index([("user_id", 1)])

    def save_many(self, user_id: str, traces: list[DecisionTrace]) -> None:
        if not traces:
            return
        docs = []
        for trace in traces:
            row = trace.model_dump()
            row["user_id"] = user_id
            docs.append(row)
        self._col.insert_many(docs)

    def list(self, user_id: str) -> list[DecisionTrace]:
        docs = self._col.find({"user_id": user_id})
        out: list[DecisionTrace] = []
        for doc in docs:
            doc.pop("_id", None)
            doc.pop("user_id", None)
            out.append(DecisionTrace.model_validate(doc))
        return out
