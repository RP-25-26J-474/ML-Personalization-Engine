from fastapi import APIRouter
from app.api.wiring import container

router = APIRouter()


@router.get("/status")
def status():
    profiles_repo = container.profiles_repo
    models_repo = container.models_repo
    category_engine = container.category_engine
    temp_detector = container.temp_detector
    user_engine = container.user_engine
    temp_baseline_repo = container.temp_baseline_repo

    # demo summary
    n_users = len(profiles_repo._profiles)
    n_versions = sum(len(v) for v in profiles_repo._profiles.values())
    category_artifacts = category_engine.artifacts
    category_is_trained = category_artifacts is not None
    category_sample_count = models_repo.category_last_n_samples or (
        int(category_artifacts.X.shape[0]) if category_artifacts is not None else 0
    )

    seq_bundle = user_engine._seq_bundle
    seq_config = seq_bundle.config if seq_bundle else {}
    user_n_clusters = models_repo.user_seq_n_clusters
    if user_n_clusters is None and seq_bundle is not None:
        user_n_clusters = int(seq_config.get("n_clusters", 0))
    user_embedding_dim = models_repo.user_seq_embedding_dim
    if user_embedding_dim is None and seq_bundle is not None:
        user_embedding_dim = int(seq_config.get("embedding_dim", 0))

    return {
        "models": {
            "global_iforest_version": models_repo.global_iforest_version,
            "category_model_version": models_repo.category_model_version,
            "user_seq_model_version": models_repo.user_seq_model_version,
            "user_model_versions": models_repo.user_model_versions,
        },
        "health_checks": {
            "category_engine_model": {
                "available": category_is_trained,
                "status": "active" if category_is_trained else "inactive",
            },
            "temp_detector_model": {
                "available": temp_detector.model is not None,
                "status": "active" if temp_detector.model is not None else "inactive",
            },
            "user_seq_model": {
                "available": seq_bundle is not None,
                "status": "active" if seq_bundle is not None else "inactive",
            },
        },
        "engine_status": {
            "category_engine": {
                "trained": category_is_trained,
                "last_n_samples": category_sample_count,
                "last_training_time": models_repo.category_last_trained_at,
            },
            "temp_detector": {
                "trained": temp_detector.model is not None,
                "quarantine_threshold": temp_detector.quarantine_threshold,
                "reject_threshold": temp_detector.reject_threshold,
                "baseline_user_count": temp_baseline_repo.stats().get("users", 0),
                "last_training_time": models_repo.global_iforest_last_trained_at,
            },
            "user_engine": {
                "trained": seq_bundle is not None,
                "n_clusters": user_n_clusters,
                "embedding_dim": user_embedding_dim,
                "last_training_time": models_repo.user_seq_last_trained_at,
            },
        },
        "data": {
            "users_with_profiles": n_users,
            "profile_versions_total": n_versions,
        },
    }
