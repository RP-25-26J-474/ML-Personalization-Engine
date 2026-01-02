from __future__ import annotations

from dataclasses import dataclass

from app.core.engine.orchestrator import Orchestrator
from app.core.engine.temp_user_detector.service import TempUserDetectorService
from app.core.engine.category_engine.service import CategoryEngineService
from app.core.engine.user_engine.service import UserEngineService

from app.core.storage.repos.profiles_repo import ProfilesRepo
from app.core.storage.repos.traces_repo import TracesRepo
from app.core.storage.repos.quarantine_repo import QuarantineRepo
from app.core.storage.repos.models_repo import ModelsRepo
from app.core.storage.repos.temp_batches_repo import TempBatchesRepo
from app.core.storage.repos.temp_baseline_repo import TempBaselineRepo


@dataclass
class Container:
    # repos
    profiles_repo: ProfilesRepo
    traces_repo: TracesRepo
    quarantine_repo: QuarantineRepo
    models_repo: ModelsRepo
    temp_batches_repo: TempBatchesRepo
    temp_baseline_repo: TempBaselineRepo

    # services
    temp_detector: TempUserDetectorService
    category_engine: CategoryEngineService
    user_engine: UserEngineService

    # orchestrator
    orchestrator: Orchestrator


def build_container() -> Container:
    profiles_repo = ProfilesRepo()
    traces_repo = TracesRepo()
    quarantine_repo = QuarantineRepo()
    models_repo = ModelsRepo()
    temp_batches_repo = TempBatchesRepo()
    temp_baseline_repo = TempBaselineRepo()

    temp_detector = TempUserDetectorService(
        model=None,
        baseline_repo=temp_baseline_repo,
    )
    category_engine = CategoryEngineService()
    user_engine = UserEngineService()

    orchestrator = Orchestrator(
        temp_detector=temp_detector,
        category_engine=category_engine,
        user_engine=user_engine,
        profiles_repo=profiles_repo,
        traces_repo=traces_repo,
        quarantine_repo=quarantine_repo,
        models_repo=models_repo,
        temp_batches_repo=temp_batches_repo,
    )

    return Container(
        profiles_repo=profiles_repo,
        traces_repo=traces_repo,
        quarantine_repo=quarantine_repo,
        models_repo=models_repo,
        temp_batches_repo=temp_batches_repo,
        temp_baseline_repo=temp_baseline_repo,
        temp_detector=temp_detector,
        category_engine=category_engine,
        user_engine=user_engine,
        orchestrator=orchestrator,
    )


container = build_container()
