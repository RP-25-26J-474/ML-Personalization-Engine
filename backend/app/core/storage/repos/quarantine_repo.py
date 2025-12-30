from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class QuarantineRow:
    user_id: str
    batch_id: str
    reason: str
    anomaly_score: float
    payload: Dict[str, Any]


@dataclass
class QuarantineRepo:
    _rows: Dict[str, List[QuarantineRow]] = field(default_factory=dict)

    def add(self, row: QuarantineRow) -> None:
        self._rows.setdefault(row.user_id, []).append(row)

    def list(self, user_id: str) -> list[QuarantineRow]:
        return list(self._rows.get(user_id, []))
