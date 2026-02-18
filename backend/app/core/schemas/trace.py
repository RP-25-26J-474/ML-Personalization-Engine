from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Any, Literal


class TraceAction(BaseModel):
    type: str
    details: dict[str, Any] = Field(default_factory=dict)


class DecisionTrace(BaseModel):
    trace_id: str
    stage: str
    inputs_summary: dict[str, Any] = Field(default_factory=dict)
    actions: list[TraceAction] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class TraceBundle(BaseModel):
    traces: list[DecisionTrace] = Field(default_factory=list)

    def add(self, trace: DecisionTrace) -> None:
        self.traces.append(trace)
