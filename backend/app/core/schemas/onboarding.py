from pydantic import BaseModel, Field
from typing import Optional


class VisionImpairmentProbs(BaseModel):
    vision_loss: float = Field(ge=0, le=1, description="Probability of generalized vision loss.")
    color_blindness: float = Field(ge=0, le=1, description="Probability of color-vision deficiency.")


class MotorImpairmentProbs(BaseModel):
    delayed_reaction: float = Field(ge=0, le=1, description="Probability of slow reaction to UI prompts.")
    inaccurate_click: float = Field(ge=0, le=1, description="Probability of imprecise pointer selection.")
    motor_impairment: float = Field(
        default=0.0,
        ge=0,
        le=1,
        description="Optional aggregate motor-impairment probability.",
    )


class ImpairmentProbs(BaseModel):
    vision: VisionImpairmentProbs
    motor: MotorImpairmentProbs
    literacy: float = Field(ge=0, le=1, description="Probability of literacy-related comprehension difficulty.")


class DeviceContext(BaseModel):
    os: Optional[str] = Field(default=None, description="Operating system name (for example: Windows).")
    browser: Optional[str] = Field(default=None, description="Browser family (for example: Chrome).")
    screen_w: Optional[int] = Field(default=None, description="Viewport or screen width in pixels.")
    screen_h: Optional[int] = Field(default=None, description="Viewport or screen height in pixels.")
    dpr: Optional[float] = Field(default=None, description="Device pixel ratio.")


class OnboardingMetrics(BaseModel):
    avg_reaction_ms: Optional[float] = Field(
        default=None, description="Average reaction latency during onboarding tasks (ms)."
    )
    hit_rate: Optional[float] = Field(
        default=None, description="Task success rate during onboarding in [0, 1]."
    )


class OnboardingResult(BaseModel):
    user_id: str = Field(description="Unique user identifier.")
    session_id: str = Field(description="Onboarding session identifier.")
    captured_at: str = Field(description="ISO-8601 timestamp when onboarding metrics were captured.")
    impairment_probs: ImpairmentProbs
    onboarding_metrics: OnboardingMetrics = Field(default_factory=OnboardingMetrics)
    device_context: DeviceContext = Field(default_factory=DeviceContext)
