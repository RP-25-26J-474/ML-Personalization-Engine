import numpy as np
from app.core.schemas.interactions import InteractionBatch


def extract_user_features(batch: InteractionBatch) -> np.ndarray:
    # same as detector for now; later add richer features
    e = batch.events_agg
    return np.array(
        [e.misclick_rate, e.avg_click_interval_ms, e.avg_dwell_ms, e.rage_clicks, e.zoom_events],
        dtype=float,
    )
