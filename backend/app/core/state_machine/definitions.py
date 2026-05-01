from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MachineDefinition:
    name: str
    initial_state: str
    transitions: dict[str, set[str]]

    def can_transition(self, from_state: str, to_state: str) -> bool:
        return to_state in self.transitions.get(from_state, set())


USER_LIFECYCLE = MachineDefinition(
    name="user_lifecycle",
    initial_state="new",
    transitions={
        "new": {"category_ready", "collecting", "nightly_eligible", "updating"},
        "category_ready": {"collecting", "nightly_eligible", "updating"},
        "collecting": {"nightly_eligible", "updating"},
        "nightly_eligible": {"collecting", "updating"},
        "updating": {"active", "collecting"},
        "active": {"collecting", "nightly_eligible", "updating"},
        "failed": {"collecting"},
    },
)

PROFILE_UPDATE = MachineDefinition(
    name="profile_update",
    initial_state="proposed",
    transitions={
        "proposed": {"validated", "aborted"},
        "validated": {"persisted", "aborted"},
        "persisted": {"activated"},
    },
)

ADAPTIVE_INPUT = MachineDefinition(
    name="adaptive_input",
    initial_state="received",
    transitions={
        "received": {"validated"},
        "validated": {"linked_to_base_version"},
        "linked_to_base_version": {"applied_in_next_update"},
    },
)

NIGHTLY_JOB = MachineDefinition(
    name="nightly_job",
    initial_state="scheduled",
    transitions={
        "scheduled": {"running_user"},
        "running_user": {"success_user", "failed_user", "completed"},
        "success_user": {"running_user", "completed"},
        "failed_user": {"running_user", "completed"},
    },
)

MACHINES: dict[str, MachineDefinition] = {
    USER_LIFECYCLE.name: USER_LIFECYCLE,
    PROFILE_UPDATE.name: PROFILE_UPDATE,
    ADAPTIVE_INPUT.name: ADAPTIVE_INPUT,
    NIGHTLY_JOB.name: NIGHTLY_JOB,
}
