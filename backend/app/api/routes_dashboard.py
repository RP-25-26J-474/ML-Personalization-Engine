from fastapi import APIRouter
from app.api.wiring import container

router = APIRouter()


@router.get("/status")
def status():
    profiles_repo = container.profiles_repo
    models_repo = container.models_repo

    # demo summary
    n_users = len(profiles_repo._profiles)
    n_versions = sum(len(v) for v in profiles_repo._profiles.values())

    return {
        "models": {
            "global_iforest_version": models_repo.global_iforest_version,
            "user_seq_model_version": models_repo.user_seq_model_version,
            "user_model_versions": models_repo.user_model_versions,
        },
        "data": {
            "users_with_profiles": n_users,
            "profile_versions_total": n_versions,
        },
    }
