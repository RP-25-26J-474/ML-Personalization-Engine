from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class PageContext(BaseModel):
    domain: Optional[str] = None
    route: Optional[str] = None
    app_type: Optional[str] = None


class EventsAgg(BaseModel):
    click_count: int = 0
    misclick_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    avg_click_interval_ms: float = Field(default=0.0, ge=0.0)
    avg_dwell_ms: float = Field(default=0.0, ge=0.0)
    rage_clicks: int = 0
    zoom_events: int = 0
    scroll_speed_px_s: float = Field(default=0.0, ge=0.0)




class InteractionBatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str
    batch_id: str
    captured_at: str
    page_context: PageContext = Field(default_factory=PageContext)
    events_agg: EventsAgg


class InteractionBatchList(BaseModel):
    batches: list[InteractionBatch] = Field(min_length=1)
