import numpy as np
from app.core.schemas.interactions import InteractionBatch


def extract_features(batch: InteractionBatch) -> np.ndarray:
    e = batch.events_agg
    vec = np.array(
        [
            e.click_count,
            e.misclick_rate,
            e.avg_click_interval_ms,
            e.avg_dwell_ms,
            e.rage_clicks,
            e.zoom_events,
            e.scroll_speed_px_s,
        ],
        dtype=float,
    )
    return vec
