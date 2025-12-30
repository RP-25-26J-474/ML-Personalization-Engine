from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any

from app.core.schemas.onboarding import OnboardingResult
from app.core.schemas.trace import DecisionTrace, TraceAction
from app.core.utils.ids import new_id

from app.core.engine.category_engine.synth_data import synthetic_category_profile
from app.core.engine.constraints.clamp import clamp_profile_dict


@dataclass
class CategoryResult:
    profile_dict: Dict[str, Any]
    confidence: float
    trace: DecisionTrace


class CategoryEngineService:
    def generate(self, onboarding: OnboardingResult) -> CategoryResult:
        probs = onboarding.impairment_probs

        # Create aggregate weights (simple blend; you can refine later)
        vision_weight = float(probs.vision.vision_loss + probs.vision.color_blindness + probs.vision.photophobia) / 3.0
        motor_weight = float(probs.motor.delayed_reaction + probs.motor.inaccurate_click + probs.motor.tremor) / 3.0
        literacy_weight = float(probs.literacy)

        base = synthetic_category_profile(
            seed=hash(onboarding.user_id) % 10_000,
            vision_weight=vision_weight,
            motor_weight=motor_weight,
            literacy_weight=literacy_weight,
        )
        clamped = clamp_profile_dict(base)

        confidence = 0.60 + 0.10 * min(1.0, (vision_weight + motor_weight + literacy_weight) / 1.5)

        trace = DecisionTrace(
            trace_id=new_id("tr"),
            stage="category_engine",
            inputs_summary={"user_id": onboarding.user_id, "session_id": onboarding.session_id},
            actions=[
                TraceAction(type="blend_probs", details={"vision_weight": vision_weight, "motor_weight": motor_weight, "literacy_weight": literacy_weight}),
                TraceAction(type="generate_synth_baseline", details={"seed": hash(onboarding.user_id) % 10_000}),
                TraceAction(type="clamp", details={}),
            ],
            metrics={"confidence": confidence},
            warnings=[],
        )

        return CategoryResult(profile_dict=clamped, confidence=float(min(1.0, confidence)), trace=trace)
