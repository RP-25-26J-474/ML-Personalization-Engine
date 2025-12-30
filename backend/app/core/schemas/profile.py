from pydantic import BaseModel, Field
from typing import Literal, Optional


ContrastMode = Literal["normal", "high"]
ThemeMode = Literal["light", "dark"]
Origin = Literal["category", "user"]


class ProfileKnobs(BaseModel):
    font_size: int = Field(ge=8, le=32)  # decide bounds later
    line_height: float = Field(ge=1.0, le=3.0)
    contrast_mode: ContrastMode
    primary_color: str
    primary_color_content: str
    secondary_color: str
    secondary_color_content: str
    accent_color: str
    accent_color_content: str
    theme: ThemeMode
    element_spacing_x: int = Field(ge=0, le=50)
    element_spacing_y: int = Field(ge=0, le=50)
    element_padding_x: int = Field(ge=0, le=50)
    element_padding_y: int = Field(ge=0, le=50)
    reduced_motion: bool
    target_size: int = Field(ge=10, le=80)
    tooltip_assist: bool
    layout_simplification: bool


class ProfileMetadata(BaseModel):
    origin: Origin
    created_at: str
    confidence_overall: float = Field(ge=0.0, le=1.0)
    version: int = 1


class PersonalizationProfile(BaseModel):
    user_id: str
    metadata: ProfileMetadata
    profile: ProfileKnobs


class ProfileDiff(BaseModel):
    changed: list[str] = Field(default_factory=list)
    old: Optional[dict] = None
    new: Optional[dict] = None
