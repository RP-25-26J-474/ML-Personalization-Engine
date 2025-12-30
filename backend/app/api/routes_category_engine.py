from fastapi import APIRouter
from pydantic import BaseModel

from app.api.wiring import container
from app.core.schemas.onboarding import OnboardingResult

router = APIRouter()


class CategoryResponse(BaseModel):
    profile: dict
    diff: dict
    traces: list[dict]


@router.post("/generate-profile", response_model=CategoryResponse)
def generate_profile(payload: OnboardingResult):
    out = container.orchestrator.handle_onboarding(payload)
    return CategoryResponse(
        profile=out.profile.model_dump(),
        diff=out.diff.model_dump() if out.diff else {},
        traces=[t.model_dump() for t in out.traces.traces],
    )
