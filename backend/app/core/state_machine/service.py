from __future__ import annotations

from typing import Any

from app.core.state_machine.definitions import MACHINES, MachineDefinition
from app.core.storage.repos.state_machine_repo import StateMachineRepo


class StateMachineError(Exception):
    def __init__(
        self,
        *,
        message: str,
        code: str,
        status_code: int = 409,
        machine: str | None = None,
        entity_id: str | None = None,
        from_state: str | None = None,
        to_state: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.machine = machine
        self.entity_id = entity_id
        self.from_state = from_state
        self.to_state = to_state

    def to_response(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "detail": self.message,
            "code": self.code,
        }
        if self.machine is not None:
            payload["machine"] = self.machine
        if self.entity_id is not None:
            payload["entity_id"] = self.entity_id
        if self.from_state is not None:
            payload["from_state"] = self.from_state
        if self.to_state is not None:
            payload["to_state"] = self.to_state
        return payload


class StateMachineService:
    def __init__(self, repo: StateMachineRepo) -> None:
        self._repo = repo

    def _definition(self, machine: str) -> MachineDefinition:
        if machine not in MACHINES:
            raise StateMachineError(
                message=f"Unknown state machine '{machine}'.",
                code="state_machine_unknown_machine",
                status_code=400,
                machine=machine,
            )
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
            message = (
                f"Invalid state transition for '{definition.name}': "
                f"'{current}' -> '{to_state}'."
            )
            if (
                definition.name == "user_lifecycle"
                and to_state == "category_ready"
                and current in {"collecting", "nightly_eligible", "updating", "active"}
            ):
                message = (
                    "Onboarding already completed for this user. "
                    "Category profile stage has already been passed."
                )
            raise StateMachineError(
                message=message,
                code="state_machine_invalid_transition",
                status_code=409,
                machine=definition.name,
                entity_id=entity_id,
                from_state=current,
                to_state=to_state,
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
            raise StateMachineError(
                message=(
                    f"State conflict for '{definition.name}' on '{entity_id}'. "
                    f"Expected '{current}', found '{fresh}'. Retry the request."
                ),
                code="state_machine_conflict",
                status_code=409,
                machine=definition.name,
                entity_id=entity_id,
                from_state=current,
                to_state=to_state,
            )
        return to_state

    def list_transitions(
        self, machine: str, entity_id: str, limit: int = 200
    ) -> list[dict[str, Any]]:
        definition = self._definition(machine)
        return self._repo.list_transitions(definition.name, entity_id, limit=limit)

