from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class PageContext(BaseModel):
    domain: Optional[str] = Field(default=None, description="Application domain where events occurred.")
    route: Optional[str] = Field(default=None, description="Route or page path related to the batch.")
    app_type: Optional[str] = Field(default=None, description="Client type (for example: web, mobile).")


class EventsAgg(BaseModel):
    click_count: int = Field(default=0, description="Total click count within this interaction window.")
    misclick_rate: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Estimated ratio of unintended clicks in [0, 1]."
    )
    avg_click_interval_ms: float = Field(
        default=0.0, ge=0.0, description="Average interval between clicks in milliseconds."
    )
    avg_dwell_ms: float = Field(
        default=0.0, ge=0.0, description="Average dwell/hesitation duration in milliseconds."
    )
    rage_clicks: int = Field(default=0, description="Count of rapid repeated clicks indicating frustration.")
    zoom_events: int = Field(default=0, description="Count of zoom-in/zoom-out actions.")
    scroll_speed_px_s: float = Field(
        default=0.0, ge=0.0, description="Average scroll speed in pixels per second."
    )




class InteractionBatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(description="Unique user identifier.")
    batch_id: str = Field(description="Interaction batch identifier.")
    captured_at: str = Field(description="ISO-8601 timestamp when the batch was captured.")
    page_context: PageContext = Field(default_factory=PageContext)
    events_agg: EventsAgg


class InteractionBatchList(BaseModel):
    batches: list[InteractionBatch] = Field(
        min_length=1,
        description="Ordered list of interaction batches for a single user.",
    )
