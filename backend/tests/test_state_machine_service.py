from __future__ import annotations

from typing import Any

import pytest

from app.core.state_machine.service import StateMachineError, StateMachineService


class FakeStateMachineRepo:
    def __init__(self) -> None:
        self.current: dict[tuple[str, str], str] = {}
        self.history: list[dict[str, Any]] = []
        self.force_conflict = False

    def get_current(self, machine: str, entity_id: str) -> str | None:
        return self.current.get((machine, entity_id))

    def init_if_missing(
        self,
        machine: str,
        entity_id: str,
        initial_state: str,
        actor: str,
        reason: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        key = (machine, entity_id)
        if key not in self.current:
            self.current[key] = initial_state
            self.history.append(
                {
                    "machine": machine,
                    "entity_id": entity_id,
                    "from_state": None,
                    "to_state": initial_state,
                    "actor": actor,
                    "reason": reason,
                    "metadata": metadata or {},
                }
            )
        return self.current[key]

    def transition(
        self,
        machine: str,
        entity_id: str,
        from_state: str,
        to_state: str,
        actor: str,
        reason: str,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        if self.force_conflict:
            return False
        key = (machine, entity_id)
        if self.current.get(key) != from_state:
            return False
        self.current[key] = to_state
        self.history.append(
            {
                "machine": machine,
                "entity_id": entity_id,
                "from_state": from_state,
                "to_state": to_state,
                "actor": actor,
                "reason": reason,
                "metadata": metadata or {},
            }
        )
        return True

    def list_transitions(self, machine: str, entity_id: str, limit: int = 200):
        rows = [
            row
            for row in self.history
            if row["machine"] == machine and row["entity_id"] == entity_id
        ]
        return rows[-limit:]


def test_ensure_initialized_creates_initial_state_once():
    repo = FakeStateMachineRepo()
    service = StateMachineService(repo=repo)

    first = service.ensure_initialized("user_lifecycle", "user-1", "test", "created")
    second = service.ensure_initialized("user_lifecycle", "user-1", "test", "retry")

    assert first == "new"
    assert second == "new"
    assert len(repo.history) == 1


def test_transition_auto_initializes_and_moves_to_valid_state():
    repo = FakeStateMachineRepo()
    service = StateMachineService(repo=repo)

    state = service.transition(
        "user_lifecycle",
        "user-1",
        "category_ready",
        "test",
        "onboarding_done",
    )

    assert state == "category_ready"
    assert repo.get_current("user_lifecycle", "user-1") == "category_ready"
    assert repo.history[-1]["from_state"] == "new"
    assert repo.history[-1]["to_state"] == "category_ready"


def test_transition_rejects_invalid_move_with_structured_error():
    repo = FakeStateMachineRepo()
    service = StateMachineService(repo=repo)
    service.ensure_initialized("profile_update", "profile-1", "test", "created")

    with pytest.raises(StateMachineError) as exc_info:
        service.transition("profile_update", "profile-1", "activated", "test", "skip")

    assert exc_info.value.status_code == 409
    assert exc_info.value.to_response() == {
        "detail": "Invalid state transition for 'profile_update': 'proposed' -> 'activated'.",
        "code": "state_machine_invalid_transition",
        "machine": "profile_update",
        "entity_id": "profile-1",
        "from_state": "proposed",
        "to_state": "activated",
    }


def test_unknown_machine_raises_bad_request_error():
    service = StateMachineService(repo=FakeStateMachineRepo())

    with pytest.raises(StateMachineError) as exc_info:
        service.current_state("unknown", "entity-1")

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "state_machine_unknown_machine"
