from fastapi import APIRouter
from app.api.wiring import container

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
