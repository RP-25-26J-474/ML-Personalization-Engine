from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class BaselineState:
    count: int
    mean: List[float]


@dataclass
class TempBaselineRepo:
    _baselines: Dict[str, BaselineState] = field(default_factory=dict)

    def update(self, user_id: str, features: list[float]) -> None:
        if user_id not in self._baselines:
            self._baselines[user_id] = BaselineState(count=1, mean=list(features))
            return

        state = self._baselines[user_id]
        state.count += 1
        n = float(state.count)
        state.mean = [
            (prev * (n - 1) + new) / n for prev, new in zip(state.mean, features)
        ]

    def get(self, user_id: str) -> list[float] | None:
        state = self._baselines.get(user_id)
        return list(state.mean) if state else None

    def stats(self) -> dict:
        return {"users": len(self._baselines)}
