from pydantic import BaseModel, Field
from typing import Optional


class VisionImpairmentProbs(BaseModel):
    vision_loss: float = Field(ge=0, le=1)
    color_blindness: float = Field(ge=0, le=1)
    photophobia: float = Field(ge=0, le=1)


class MotorImpairmentProbs(BaseModel):
    delayed_reaction: float = Field(ge=0, le=1)
    inaccurate_click: float = Field(ge=0, le=1)
    tremor: float = Field(ge=0, le=1)


class ImpairmentProbs(BaseModel):
    vision: VisionImpairmentProbs
    motor: MotorImpairmentProbs
    literacy: float = Field(ge=0, le=1)


class DeviceContext(BaseModel):
    os: Optional[str] = None
    browser: Optional[str] = None
    screen_w: Optional[int] = None
    screen_h: Optional[int] = None
    dpr: Optional[float] = None


class OnboardingMetrics(BaseModel):
    avg_reaction_ms: Optional[float] = None
    hit_rate: Optional[float] = None
    color_confusion_rate: Optional[float] = None
    reading_score: Optional[float] = None


class OnboardingResult(BaseModel):
    user_id: str
    session_id: str
    captured_at: str  # ISO string for demo simplicity
    impairment_probs: ImpairmentProbs
    onboarding_metrics: OnboardingMetrics = Field(default_factory=OnboardingMetrics)
    device_context: DeviceContext = Field(default_factory=DeviceContext)
