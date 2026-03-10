from pydantic import BaseModel, Field
from typing import Literal, Optional


ContrastMode = Literal["normal", "high"]
ThemeMode = Literal["light", "dark"]
Origin = Literal["category", "user"]


class ProfileKnobs(BaseModel):
    font_size: int = Field(ge=8, le=32, description="Recommended base font size in CSS pixels.")
    line_height: float = Field(ge=1.0, le=3.0, description="Recommended line-height multiplier.")
    contrast_mode: ContrastMode = Field(description="Contrast mode preference.")
    primary_color: str = Field(description="Primary UI color in hex.")
    primary_color_content: str = Field(description="Foreground/content color used on primary color.")
    secondary_color: str = Field(description="Secondary UI color in hex.")
    secondary_color_content: str = Field(description="Foreground/content color used on secondary color.")
    accent_color: str = Field(description="Accent UI color in hex.")
    accent_color_content: str = Field(description="Foreground/content color used on accent color.")
    theme: ThemeMode = Field(description="Preferred light/dark theme.")
    element_spacing_x: int = Field(ge=0, le=50, description="Horizontal spacing between nearby UI elements.")
    element_spacing_y: int = Field(ge=0, le=50, description="Vertical spacing between nearby UI elements.")
    element_padding_x: int = Field(ge=0, le=50, description="Horizontal internal padding for controls.")
    element_padding_y: int = Field(ge=0, le=50, description="Vertical internal padding for controls.")
    reduced_motion: bool = Field(description="Whether reduced-motion UI behavior is recommended.")
    target_size: int = Field(ge=10, le=80, description="Recommended interactive target size in CSS pixels.")
    tooltip_assist: bool = Field(description="Whether contextual tooltip assistance is recommended.")
    layout_simplification: bool = Field(description="Whether simplified layout mode is recommended.")


class ProfileMetadata(BaseModel):
    origin: Origin = Field(description="Profile source: category cold-start or user adaptation.")
    created_at: str = Field(description="ISO-8601 timestamp when this version was generated.")
    confidence_overall: float = Field(ge=0.0, le=1.0, description="Overall confidence score in [0, 1].")
    version: int = Field(default=1, description="Monotonic profile version number for this user.")


class PersonalizationProfile(BaseModel):
    user_id: str = Field(description="Unique user identifier.")
    metadata: ProfileMetadata
    profile: ProfileKnobs


class ProfileDiff(BaseModel):
    changed: list[str] = Field(default_factory=list, description="List of profile knob keys that changed.")
    old: Optional[dict] = Field(default=None, description="Previous values for changed keys.")
    new: Optional[dict] = Field(default=None, description="New values for changed keys.")
