from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List
from app.core.schemas.trace import DecisionTrace


@dataclass
class TracesRepo:
    _traces: Dict[str, List[DecisionTrace]] = field(default_factory=dict)

    def save_many(self, user_id: str, traces: list[DecisionTrace]) -> None:
        self._traces.setdefault(user_id, []).extend(traces)

    def list(self, user_id: str) -> list[DecisionTrace]:
        return list(self._traces.get(user_id, []))
