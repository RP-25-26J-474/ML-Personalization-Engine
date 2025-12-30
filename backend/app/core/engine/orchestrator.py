from __future__ import annotations
from dataclasses import dataclass

from app.core.schemas.onboarding import OnboardingResult
from app.core.schemas.interactions import InteractionBatch
from app.core.schemas.profile import (
    PersonalizationProfile,
    ProfileMetadata,
    ProfileKnobs,
    ProfileDiff,
)
from app.core.schemas.trace import TraceBundle
from app.core.utils.time import now_iso

from app.core.engine.temp_user_detector.service import TempUserDetectorService
from app.core.engine.category_engine.service import CategoryEngineService
from app.core.engine.user_engine.service import UserEngineService
from app.core.engine.merge.merge_policy import merge_profiles
from app.core.engine.merge.diff import diff_profiles

from app.core.storage.repos.profiles_repo import ProfilesRepo
from app.core.storage.repos.traces_repo import TracesRepo
from app.core.storage.repos.quarantine_repo import QuarantineRepo, QuarantineRow
from app.core.storage.repos.models_repo import ModelsRepo


@dataclass
class OrchestratorResult:
    profile: PersonalizationProfile | None
    diff: ProfileDiff | None
    traces: TraceBundle
    quarantined: bool = False
    anomaly_score: float | None = None


class Orchestrator:
    def __init__(
        self,
        temp_detector: TempUserDetectorService,
        category_engine: CategoryEngineService,
        user_engine: UserEngineService,
        profiles_repo: ProfilesRepo,
        traces_repo: TracesRepo,
        quarantine_repo: QuarantineRepo,
        models_repo: ModelsRepo,
    ):
        self.temp_detector = temp_detector
        self.category_engine = category_engine
        self.user_engine = user_engine

        self.profiles_repo = profiles_repo
        self.traces_repo = traces_repo
        self.quarantine_repo = quarantine_repo
        self.models_repo = models_repo

    # --------- Category (new user) ----------
    def handle_onboarding(self, onboarding: OnboardingResult) -> OrchestratorResult:
        traces = TraceBundle()

        cat = self.category_engine.generate(onboarding)
        traces.add(cat.trace)

        # versioning
        prev = self.profiles_repo.get_latest(onboarding.user_id)
        next_version = (prev.metadata.version + 1) if prev else 1

        profile = PersonalizationProfile(
            user_id=onboarding.user_id,
            metadata=ProfileMetadata(
                origin="category",
                created_at=now_iso(),
                confidence_overall=cat.confidence,
                version=next_version,
            ),
            profile=ProfileKnobs(**cat.profile_dict),
        )

        self.profiles_repo.save_version(profile)
        self.traces_repo.save_many(onboarding.user_id, traces.traces)

        d = diff_profiles(prev.profile.model_dump() if prev else None, profile.profile.model_dump())
        return OrchestratorResult(profile=profile, diff=d, traces=traces)

    # --------- User update (existing user) ----------
    def handle_interactions(self, batch: InteractionBatch) -> OrchestratorResult:
        traces = TraceBundle()

        # 1) Filter
        filt = self.temp_detector.score_batch(batch)
        traces.add(filt.trace)

        if filt.is_quarantined:
            self.quarantine_repo.add(
                QuarantineRow(
                    user_id=batch.user_id,
                    batch_id=batch.batch_id,
                    reason=filt.reason or "unknown",
                    anomaly_score=filt.anomaly_score,
                    payload=batch.model_dump(),
                )
            )
            self.traces_repo.save_many(batch.user_id, traces.traces)
            return OrchestratorResult(
                profile=None,
                diff=None,
                traces=traces,
                quarantined=True,
                anomaly_score=filt.anomaly_score,
            )

        # 2) Need a baseline profile. If none exists, create a default-ish baseline.
        prev = self.profiles_repo.get_latest(batch.user_id)
        if prev is None:
            # If missing, synthesize a minimal safe category baseline
            # (in real system, you’d require onboarding first)
            category_base = {
                "font_size": 12,
                "line_height": 1.6,
                "contrast_mode": "high",
                "primary_color": "#1a73e8",
                "primary_color_content": "#ffffff",
                "secondary_color": "#1a73e8",
                "secondary_color_content": "#ffffff",
                "accent_color": "#e37400",
                "accent_color_content": "#ffffff",
                "theme": "light",
                "element_spacing_x": 6,
                "element_spacing_y": 3,
                "element_padding_x": 8,
                "element_padding_y": 8,
                "reduced_motion": True,
                "target_size": 28,
                "tooltip_assist": False,
                "layout_simplification": False,
            }
        else:
            category_base = prev.profile.model_dump()

        # 3) User-wise suggestion
        user_res = self.user_engine.suggest(batch)
        traces.add(user_res.trace)

        # 4) Merge + clamp
        merged = merge_profiles(category_base, user_res.suggestion_dict)

        # 5) Save new profile version
        next_version = (prev.metadata.version + 1) if prev else 1
        profile = PersonalizationProfile(
            user_id=batch.user_id,
            metadata=ProfileMetadata(
                origin="user",
                created_at=now_iso(),
                confidence_overall=user_res.confidence,
                version=next_version,
            ),
            profile=ProfileKnobs(**merged),
        )

        self.profiles_repo.save_version(profile)
        self.traces_repo.save_many(batch.user_id, traces.traces)

        d = diff_profiles(prev.profile.model_dump() if prev else None, profile.profile.model_dump())
        return OrchestratorResult(profile=profile, diff=d, traces=traces)
