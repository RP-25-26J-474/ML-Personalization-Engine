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
from app.core.schemas.trace import TraceBundle, DecisionTrace, TraceAction
from app.core.utils.ids import new_id
from app.core.utils.time import now_iso

from app.core.engine.temp_user_detector.service import TempUserDetectorService
from app.core.engine.category_engine.service import CategoryEngineService
from app.core.engine.user_engine.service import UserEngineService
from app.core.engine.merge.merge_policy import merge_profiles
from app.core.engine.merge.diff import diff_profiles

from app.core.storage.repos.profiles_repo import ProfilesRepo
from app.core.storage.repos.traces_repo import TracesRepo
from app.core.storage.repos.models_repo import ModelsRepo
from app.core.storage.repos.temp_batches_repo import TempBatchesRepo, TempBatchRecord
from app.core.state_machine.service import StateMachineService
from app.core.state_machine.definitions import (
    USER_LIFECYCLE,
    PROFILE_UPDATE,
)


@dataclass
class OrchestratorResult:
    profile: PersonalizationProfile | None
    diff: ProfileDiff | None
    traces: TraceBundle
    quarantined: bool = False
    anomaly_score: float | None = None
    quality: dict | None = None


@dataclass
class OrchestratorBatchResult:
    profile: PersonalizationProfile | None
    diff: ProfileDiff | None
    traces: TraceBundle
    quarantined: bool
    kept_batches: list[str]
    quarantined_batches: list[dict]
    rejected_batches: list[dict]


class Orchestrator:
    def __init__(
        self,
        temp_detector: TempUserDetectorService,
        category_engine: CategoryEngineService,
        user_engine: UserEngineService,
        profiles_repo: ProfilesRepo,
        traces_repo: TracesRepo,
        models_repo: ModelsRepo,
        temp_batches_repo: TempBatchesRepo,
        state_machine_service: StateMachineService,
    ):
        self.temp_detector = temp_detector
        self.category_engine = category_engine
        self.user_engine = user_engine

        self.profiles_repo = profiles_repo
        self.traces_repo = traces_repo
        self.models_repo = models_repo
        self.temp_batches_repo = temp_batches_repo
        self.state_machine = state_machine_service

    def _sm_init(
        self,
        traces: TraceBundle,
        *,
        machine: str,
        entity_id: str,
        actor: str,
        reason: str,
        metadata: dict | None = None,
    ) -> None:
        current = self.state_machine.current_state(machine, entity_id)
        state = self.state_machine.ensure_initialized(
            machine=machine,
            entity_id=entity_id,
            actor=actor,
            reason=reason,
            metadata=metadata,
        )
        if current is None:
            message = (
                f"[SM:{machine}] {entity_id}: initialized to '{state}' "
                f"(reason: {reason})"
            )
            traces.add(
                DecisionTrace(
                    trace_id=new_id("tr"),
                    stage="state_machine",
                    inputs_summary={
                        "machine": machine,
                        "entity_id": entity_id,
                        "event": "initialized",
                        "to_state": state,
                    },
                    actions=[
                        TraceAction(
                            type="state_initialized",
                            details={
                                "machine": machine,
                                "entity_id": entity_id,
                                "to_state": state,
                                "reason": reason,
                                "message": message,
                                "metadata": metadata or {},
                            },
                        )
                    ],
                    warnings=[message],
                )
            )

    def _sm_transition(
        self,
        traces: TraceBundle,
        *,
        machine: str,
        entity_id: str,
        to_state: str,
        actor: str,
        reason: str,
        metadata: dict | None = None,
    ) -> None:
        from_state = self.state_machine.current_state(machine, entity_id)
        state = self.state_machine.transition(
            machine=machine,
            entity_id=entity_id,
            to_state=to_state,
            actor=actor,
            reason=reason,
            metadata=metadata,
        )
        if from_state == state:
            message = (
                f"[SM:{machine}] {entity_id}: stayed at '{state}' "
                f"(reason: {reason})"
            )
            event = "state_no_op"
        else:
            message = (
                f"[SM:{machine}] {entity_id}: '{from_state}' -> '{state}' "
                f"(reason: {reason})"
            )
            event = "state_transitioned"

        traces.add(
            DecisionTrace(
                trace_id=new_id("tr"),
                stage="state_machine",
                inputs_summary={
                    "machine": machine,
                    "entity_id": entity_id,
                    "event": event,
                    "from_state": from_state,
                    "to_state": state,
                },
                actions=[
                    TraceAction(
                        type=event,
                        details={
                            "machine": machine,
                            "entity_id": entity_id,
                            "from_state": from_state,
                            "to_state": state,
                            "reason": reason,
                            "message": message,
                            "metadata": metadata or {},
                        },
                    )
                ],
                warnings=[message],
            )
        )

    # --------- Category (new user) ----------
    def handle_onboarding(self, onboarding: OnboardingResult) -> OrchestratorResult:
        traces = TraceBundle()
        self._sm_init(
            traces,
            machine=USER_LIFECYCLE.name,
            entity_id=onboarding.user_id,
            actor="orchestrator",
            reason="onboarding_received",
        )

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
        self._sm_transition(
            traces,
            machine=USER_LIFECYCLE.name,
            entity_id=onboarding.user_id,
            to_state="category_ready",
            actor="orchestrator",
            reason="category_profile_generated",
            metadata={"version": next_version},
        )
        self._sm_transition(
            traces,
            machine=USER_LIFECYCLE.name,
            entity_id=onboarding.user_id,
            to_state="collecting",
            actor="orchestrator",
            reason="onboarding_completed",
        )
        self.traces_repo.save_many(onboarding.user_id, traces.traces)

        d = diff_profiles(prev.profile.model_dump() if prev else None, profile.profile.model_dump())
        quality = {
            "nearest_neighbor_distance": cat.nearest_neighbor_distance,
            "nearest_neighbor_similarity": cat.nearest_neighbor_similarity,
            "neighbor_indices": cat.neighbor_indices,
            "neighbor_distances": cat.neighbor_distances,
        }
        return OrchestratorResult(profile=profile, diff=d, traces=traces, quality=quality)

    # --------- User update (existing user) ----------
    def handle_interactions(self, batch: InteractionBatch) -> OrchestratorResult:
        traces = TraceBundle()
        self._sm_init(
            traces,
            machine=USER_LIFECYCLE.name,
            entity_id=batch.user_id,
            actor="orchestrator",
            reason="interaction_received",
        )

        # 1) Filter
        filt = self.temp_detector.score_batch(batch)
        traces.add(filt.trace)
        self.temp_batches_repo.add(
            TempBatchRecord(
                user_id=batch.user_id,
                batch_id=batch.batch_id,
                captured_at=batch.captured_at,
                outcome=filt.outcome,
                anomaly_score=filt.anomaly_score,
                similarity_score=filt.similarity_score,
                heuristic_components=filt.heuristic_components,
                features=filt.features,
                payload=batch.model_dump(),
            )
        )

        if filt.outcome == "keep":
            self.temp_detector.update_baseline(batch.user_id, filt.features)

        if filt.is_quarantined:
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
        update_entity = f"{batch.user_id}:{next_version}"
        self._sm_init(
            traces,
            machine=PROFILE_UPDATE.name,
            entity_id=update_entity,
            actor="orchestrator",
            reason="profile_update_started",
        )
        self._sm_transition(
            traces,
            machine=PROFILE_UPDATE.name,
            entity_id=update_entity,
            to_state="validated",
            actor="orchestrator",
            reason="merge_validated",
        )
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
        self._sm_transition(
            traces,
            machine=PROFILE_UPDATE.name,
            entity_id=update_entity,
            to_state="persisted",
            actor="orchestrator",
            reason="profile_saved",
        )
        self._sm_transition(
            traces,
            machine=PROFILE_UPDATE.name,
            entity_id=update_entity,
            to_state="activated",
            actor="orchestrator",
            reason="profile_activated",
        )
        self._sm_transition(
            traces,
            machine=USER_LIFECYCLE.name,
            entity_id=batch.user_id,
            to_state="nightly_eligible",
            actor="orchestrator",
            reason="kept_interaction_processed",
        )
        self._sm_transition(
            traces,
            machine=USER_LIFECYCLE.name,
            entity_id=batch.user_id,
            to_state="updating",
            actor="orchestrator",
            reason="user_profile_update_started",
        )
        self._sm_transition(
            traces,
            machine=USER_LIFECYCLE.name,
            entity_id=batch.user_id,
            to_state="active",
            actor="orchestrator",
            reason="user_profile_update_completed",
            metadata={"version": next_version},
        )
        self._sm_transition(
            traces,
            machine=USER_LIFECYCLE.name,
            entity_id=batch.user_id,
            to_state="collecting",
            actor="orchestrator",
            reason="resume_collection_after_update",
        )
        self.traces_repo.save_many(batch.user_id, traces.traces)

        d = diff_profiles(prev.profile.model_dump() if prev else None, profile.profile.model_dump())
        return OrchestratorResult(profile=profile, diff=d, traces=traces)


    def handle_interactions_many(self, batches: list[InteractionBatch]) -> OrchestratorBatchResult:
        traces = TraceBundle()

        kept: list[InteractionBatch] = []
        quarantined_batches: list[dict] = []
        rejected_batches: list[dict] = []

        for batch in batches:
            filt = self.temp_detector.score_batch(batch)
            traces.add(filt.trace)
            self.temp_batches_repo.add(
                TempBatchRecord(
                    user_id=batch.user_id,
                    batch_id=batch.batch_id,
                    captured_at=batch.captured_at,
                    outcome=filt.outcome,
                    anomaly_score=filt.anomaly_score,
                    similarity_score=filt.similarity_score,
                    heuristic_components=filt.heuristic_components,
                    features=filt.features,
                    payload=batch.model_dump(),
                )
            )

            if filt.outcome == "keep":
                self.temp_detector.update_baseline(batch.user_id, filt.features)

            if filt.is_quarantined:
                row = {
                    "batch_id": batch.batch_id,
                    "outcome": filt.outcome,
                    "anomaly_score": filt.anomaly_score,
                    "reason": filt.reason,
                }
                if filt.is_rejected:
                    rejected_batches.append(row)
                else:
                    quarantined_batches.append(row)
            else:
                kept.append(batch)

        if not kept:
            self.traces_repo.save_many(batches[0].user_id, traces.traces)
            return OrchestratorBatchResult(
                profile=None,
                diff=None,
                traces=traces,
                quarantined=True,
                kept_batches=[],
                quarantined_batches=quarantined_batches,
                rejected_batches=rejected_batches,
            )

        user_id = kept[0].user_id
        prev = self.profiles_repo.get_latest(user_id)
        if prev is None:
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

        user_res = self.user_engine.suggest_many(kept)
        traces.add(user_res.trace)

        merged = merge_profiles(category_base, user_res.suggestion_dict)

        next_version = (prev.metadata.version + 1) if prev else 1
        profile = PersonalizationProfile(
            user_id=user_id,
            metadata=ProfileMetadata(
                origin="user",
                created_at=now_iso(),
                confidence_overall=user_res.confidence,
                version=next_version,
            ),
            profile=ProfileKnobs(**merged),
        )

        self.profiles_repo.save_version(profile)
        self.traces_repo.save_many(user_id, traces.traces)

        d = diff_profiles(prev.profile.model_dump() if prev else None, profile.profile.model_dump())
        return OrchestratorBatchResult(
            profile=profile,
            diff=d,
            traces=traces,
            quarantined=False,
            kept_batches=[b.batch_id for b in kept],
            quarantined_batches=quarantined_batches,
            rejected_batches=rejected_batches,
        )
