from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, ValidationError
import csv
from io import StringIO
import numpy as np

from app.api.wiring import container
from app.core.schemas.onboarding import OnboardingResult
from app.core.schemas.profile import ProfileKnobs
from app.core.engine.category_engine.umap_projector import fit_umap_2d, fit_umap_3d
from app.core.engine.category_engine.model_knn import FEATURE_ORDER

router = APIRouter()
PROFILE_FIELDS = list(ProfileKnobs.model_fields.keys())


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


@router.post("/train-csv")
async def train_category_csv(file: UploadFile = File(...)):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="CSV upload is empty.")

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="CSV must be UTF-8 encoded."
        ) from exc

    reader = csv.DictReader(StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV is missing headers.")

    def normalize_header(value: str) -> str:
        return value.replace("\ufeff", "").strip().lower()

    header_map = {normalize_header(h): h for h in reader.fieldnames if h}
    required = set(FEATURE_ORDER) | set(PROFILE_FIELDS)
    required_norm = {normalize_header(key): key for key in required}
    missing = sorted(
        required_norm[key] for key in required_norm.keys() - set(header_map.keys())
    )
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing required columns: {', '.join(missing)}.",
        )

    Xdicts: list[dict[str, float]] = []
    profiles: list[dict] = []
    for row_index, row in enumerate(reader, start=2):
        features: dict[str, float] = {}
        for key in FEATURE_ORDER:
            raw_value = (row.get(header_map[normalize_header(key)], "") or "").strip()
            if raw_value == "":
                raise HTTPException(
                    status_code=400,
                    detail=f"Row {row_index}: missing value for '{key}'.",
                )
            try:
                features[key] = float(raw_value)
            except ValueError as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Row {row_index}: invalid float for '{key}'.",
                ) from exc

        raw_profile = {
            key: (row.get(header_map[normalize_header(key)], "") or "").strip()
            for key in PROFILE_FIELDS
        }
        try:
            profile = ProfileKnobs.model_validate(raw_profile)
        except ValidationError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Row {row_index}: invalid profile values.",
            ) from exc

        Xdicts.append(features)
        profiles.append(profile.model_dump())

    if not Xdicts:
        raise HTTPException(status_code=400, detail="CSV has no data rows.")

    container.category_engine.train_from_data(Xdicts, profiles)
    return {
        "status": "trained",
        "n_samples": len(Xdicts),
        "artifact_key": "category_engine/category_best",
        "source": "csv",
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
