from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock

from app.core.schemas.trace import DecisionTrace


class TracesRepo:
    def __init__(self) -> None:
        # In-memory trace logs (demo mode): avoids DB write overhead.
        self._rows_by_user: dict[str, deque[dict]] = defaultdict(
            lambda: deque(maxlen=2000)
        )
        self._lock = Lock()

    def save_many(self, user_id: str, traces: list[DecisionTrace]) -> None:
        if not traces:
            return
        rows = [trace.model_dump() for trace in traces]
        with self._lock:
            self._rows_by_user[user_id].extend(rows)

    def list(self, user_id: str) -> list[DecisionTrace]:
        with self._lock:
            docs = list(self._rows_by_user.get(user_id, ()))
        return [DecisionTrace.model_validate(doc) for doc in docs]
