from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np

from app.api.wiring import container
from app.core.schemas.onboarding import OnboardingResult
from app.core.engine.category_engine.umap_projector import fit_umap_2d, fit_umap_3d
from app.core.engine.category_engine.model_knn import FEATURE_ORDER

router = APIRouter()


class CategoryResponse(BaseModel):
    profile: dict
    diff: dict
    traces: list[dict]
    quality: dict


@router.post("/generate-profile", response_model=CategoryResponse)
def generate_profile(payload: OnboardingResult):
    out = container.orchestrator.handle_onboarding(payload)
    return CategoryResponse(
        profile=out.profile.model_dump(),
        diff=out.diff.model_dump() if out.diff else {},
        traces=[t.model_dump() for t in out.traces.traces],
        quality=out.quality or {},
    )


class TrainCategoryRequest(BaseModel):
    n_synth: int = 400


@router.post("/train")
def train_category(req: TrainCategoryRequest):
    container.category_engine.train_from_synth(n=req.n_synth)
    return {
        "status": "trained",
        "n_samples": req.n_synth,
        "artifact_key": "category_engine/category_best",
    }

class VectorSpaceResponse(BaseModel):
    points_2d: list[list[float]]
    feature_order: list[str]


@router.get("/vector-space", response_model=VectorSpaceResponse)
def vector_space():
    artifacts = container.category_engine.get_artifacts(n=400)

    X = artifacts.X
    _, Z = fit_umap_2d(X)
    return VectorSpaceResponse(points_2d=Z.tolist(), feature_order=FEATURE_ORDER)


class VectorSpace3DPoint(BaseModel):
    id: int
    coords: list[float]
    features: dict[str, float]
    profile: dict


class VectorSpace3DResponse(BaseModel):
    points: list[VectorSpace3DPoint]
    feature_order: list[str]


@router.get("/vector-space-3d", response_model=VectorSpace3DResponse)
def vector_space_3d():
    artifacts = container.category_engine.get_artifacts(n=400)

    X = artifacts.X
    _, Z = fit_umap_3d(X)
    points = []
    for idx, coords in enumerate(Z.tolist()):
        features = {
            FEATURE_ORDER[i]: float(X[idx][i]) for i in range(len(FEATURE_ORDER))
        }
        points.append(
            VectorSpace3DPoint(
                id=idx, coords=coords, features=features, profile=artifacts.profiles[idx]
            )
        )
    return VectorSpace3DResponse(points=points, feature_order=FEATURE_ORDER)
