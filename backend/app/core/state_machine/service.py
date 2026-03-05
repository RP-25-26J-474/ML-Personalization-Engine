from __future__ import annotations

from typing import Any

from app.core.state_machine.definitions import MACHINES, MachineDefinition
from app.core.storage.repos.state_machine_repo import StateMachineRepo


class StateMachineService:
    def __init__(self, repo: StateMachineRepo) -> None:
        self._repo = repo

    def _definition(self, machine: str) -> MachineDefinition:
        if machine not in MACHINES:
            raise ValueError(f"unknown state machine: {machine}")
        return MACHINES[machine]

    def ensure_initialized(
        self,
        machine: str,
        entity_id: str,
        actor: str,
        reason: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        definition = self._definition(machine)
        return self._repo.init_if_missing(
            machine=definition.name,
            entity_id=entity_id,
            initial_state=definition.initial_state,
            actor=actor,
            reason=reason,
            metadata=metadata,
        )

    def current_state(self, machine: str, entity_id: str) -> str | None:
        definition = self._definition(machine)
        return self._repo.get_current(definition.name, entity_id)

    def transition(
        self,
        machine: str,
        entity_id: str,
        to_state: str,
        actor: str,
        reason: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        definition = self._definition(machine)
        current = self._repo.get_current(definition.name, entity_id)
        if current is None:
            current = self._repo.init_if_missing(
                machine=definition.name,
                entity_id=entity_id,
                initial_state=definition.initial_state,
                actor=actor,
                reason="auto_initialize",
                metadata={"reason": reason},
            )

        if current == to_state:
            return current

        if not definition.can_transition(current, to_state):
            raise ValueError(
                f"invalid transition for {definition.name}: {current} -> {to_state}"
            )

        ok = self._repo.transition(
            machine=definition.name,
            entity_id=entity_id,
            from_state=current,
            to_state=to_state,
            actor=actor,
            reason=reason,
            metadata=metadata,
        )
        if not ok:
            fresh = self._repo.get_current(definition.name, entity_id)
            raise ValueError(
                f"state conflict for {definition.name}:{entity_id}, expected={current}, current={fresh}"
            )
        return to_state

    def list_transitions(
        self, machine: str, entity_id: str, limit: int = 200
    ) -> list[dict[str, Any]]:
        definition = self._definition(machine)
        return self._repo.list_transitions(definition.name, entity_id, limit=limit)

