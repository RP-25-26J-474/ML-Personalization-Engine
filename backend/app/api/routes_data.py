from fastapi import APIRouter, HTTPException
from app.api.wiring import container
from app.core.engine.merge.diff import diff_profiles

router = APIRouter()


@router.get("/profiles")
def list_profiles(user_id: str):
    versions = container.profiles_repo.list_versions(user_id)
    return [p.model_dump() for p in versions]


@router.get("/traces")
def list_traces(user_id: str):
    traces = container.traces_repo.list(user_id)
    return [t.model_dump() for t in traces]


@router.get("/quarantine")
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


@router.get("/profile-diffs")
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


@router.get("/current-profile")
def get_current_profile(user_id: str):
    current = container.profiles_repo.get_current(user_id)
    if current is None:
        raise HTTPException(status_code=404, detail=f"current profile not found for user_id={user_id}")
    return current
