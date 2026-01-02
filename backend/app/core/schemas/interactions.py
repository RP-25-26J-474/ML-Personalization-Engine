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


class ProfilerMeta(BaseModel):
    sampling_hz: Optional[int] = None
    input_lag_ms_est: Optional[float] = None


class InteractionSample(BaseModel):
    t: int
    type: str
    x: Optional[float] = None
    y: Optional[float] = None
    target_w: Optional[float] = None
    target_h: Optional[float] = None


class InteractionBatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str
    batch_id: str
    captured_at: str
    page_context: PageContext = Field(default_factory=PageContext)
    events_agg: EventsAgg
    raw_samples_optional: list[InteractionSample] = Field(default_factory=list)
    profiler: ProfilerMeta = Field(default_factory=ProfilerMeta, alias="_profiler")


class InteractionBatchList(BaseModel):
    batches: list[InteractionBatch] = Field(min_length=1)
