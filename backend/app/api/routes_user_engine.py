from fastapi import APIRouter
from pydantic import BaseModel

from app.api.wiring import container
from app.core.schemas.interactions import InteractionBatch

router = APIRouter()


class UserUpdateResponse(BaseModel):
    quarantined: bool
    anomaly_score: float | None = None
    profile: dict | None = None
    diff: dict | None = None
    traces: list[dict]


@router.post("/update-profile", response_model=UserUpdateResponse)
def update_profile(batch: InteractionBatch):
    out = container.orchestrator.handle_interactions(batch)
    return UserUpdateResponse(
        quarantined=out.quarantined,
        anomaly_score=out.anomaly_score,
        profile=out.profile.model_dump() if out.profile else None,
        diff=out.diff.model_dump() if out.diff else None,
        traces=[t.model_dump() for t in out.traces.traces],
    )
