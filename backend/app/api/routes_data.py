from fastapi import APIRouter, HTTPException
from app.api.wiring import container
from app.core.engine.merge.diff import diff_profiles
from app.core.state_machine.definitions import MACHINES

router = APIRouter()


@router.get(
    "/profiles",
    summary="List profile versions",
    description="Returns all stored profile versions for a user ordered by persistence sequence.",
)
def list_profiles(user_id: str):
    versions = container.profiles_repo.list_versions(user_id)
    return [p.model_dump() for p in versions]


@router.get(
    "/traces",
    summary="List decision traces",
    description="Returns trace records captured during category and user-engine personalization decisions.",
)
def list_traces(user_id: str):
    traces = container.traces_repo.list(user_id)
    return [t.model_dump() for t in traces]


@router.get(
    "/quarantine",
    summary="List quarantined batches",
    description="Returns interaction batches quarantined or rejected by the temporary user detector.",
)
def list_quarantine(user_id: str):
    rows = container.quarantine_repo.list(user_id)
    return [
        {
            "user_id": r.user_id,
            "batch_id": r.batch_id,
            "reason": r.reason,
            "anomaly_score": r.anomaly_score,
            "payload": r.payload,
        }
        for r in rows
    ]


@router.get(
    "/profile-diffs",
    summary="List profile change history",
    description="Computes version-to-version profile diffs to show exactly which knobs changed over time.",
)
def list_profile_diffs(user_id: str):
    versions = container.profiles_repo.list_versions(user_id)
    if not versions:
        return []

    history = []
    for idx, profile in enumerate(versions):
        prev = versions[idx - 1] if idx > 0 else None
        diff = diff_profiles(
            prev.profile.model_dump() if prev else None,
            profile.profile.model_dump(),
        )
        old_values = (
            {k: diff.old.get(k) for k in diff.changed} if diff.old else None
        )
        new_values = (
            {k: diff.new.get(k) for k in diff.changed} if diff.new else None
        )
        history.append(
            {
                "user_id": profile.user_id,
                "version": profile.metadata.version,
                "created_at": profile.metadata.created_at,
                "origin": profile.metadata.origin,
                "confidence_overall": profile.metadata.confidence_overall,
                "changed": diff.changed,
                "old": old_values,
                "new": new_values,
            }
        )
    return history


@router.get(
    "/current-profile",
    summary="Get current profile",
    description="Fetches the latest personalization profile for a user.",
)
def get_current_profile(user_id: str):
    current = container.profiles_repo.get_current(user_id)
    if current is None:
        raise HTTPException(status_code=404, detail=f"current profile not found for user_id={user_id}")
    return current


@router.get(
    "/state/current",
    summary="Get state machine current state",
    description="Returns the active state for a specific machine/entity pair.",
)
def get_state_current(machine: str, entity_id: str):
    if machine not in MACHINES:
        raise HTTPException(status_code=400, detail=f"unknown machine: {machine}")
    state = container.state_machine_service.current_state(machine, entity_id)
    if state is None:
        raise HTTPException(
            status_code=404,
            detail=f"state not found for machine={machine}, entity_id={entity_id}",
        )
    return {"machine": machine, "entity_id": entity_id, "state": state}


@router.get(
    "/state/transitions",
    summary="List state transitions",
    description="Returns recent state transition events for a machine/entity pair.",
)
def list_state_transitions(machine: str, entity_id: str, limit: int = 200):
    if machine not in MACHINES:
        raise HTTPException(status_code=400, detail=f"unknown machine: {machine}")
    if limit < 1:
        raise HTTPException(status_code=400, detail="limit must be >= 1")
    return container.state_machine_service.list_transitions(
        machine=machine,
        entity_id=entity_id,
        limit=min(limit, 1000),
    )
