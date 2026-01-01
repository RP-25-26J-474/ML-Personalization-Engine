from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List


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


@dataclass
class TempBatchesRepo:
    _rows: Dict[str, List[TempBatchRecord]] = field(default_factory=dict)

    def add(self, row: TempBatchRecord) -> None:
        self._rows.setdefault(row.user_id, []).append(row)

    def list(self, user_id: str) -> list[TempBatchRecord]:
        return list(self._rows.get(user_id, []))

    def list_all(self) -> list[TempBatchRecord]:
        out: list[TempBatchRecord] = []
        for rows in self._rows.values():
            out.extend(rows)
        return out

    def stats(self) -> dict:
        rows = self.list_all()
        counts = {"keep": 0, "quarantine": 0, "reject": 0}
        for row in rows:
            if row.outcome in counts:
                counts[row.outcome] += 1
        return {
            "total": len(rows),
            "kept": counts["keep"],
            "quarantined": counts["quarantine"],
            "rejected": counts["reject"],
            "user_count": len(self._rows),
        }
