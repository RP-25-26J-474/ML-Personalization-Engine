from __future__ import annotations
import random
from typing import Dict, List


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def generate_synth_interactions(n: int = 400, seed: int = 42) -> List[Dict[str, float]]:
    rng = random.Random(seed)
    rows: List[Dict[str, float]] = []

    for _ in range(n):
        profile = rng.choices(
            ["normal", "risky", "chaotic"],
            weights=[0.7, 0.2, 0.1],
            k=1,
        )[0]

        if profile == "normal":
            click_count = rng.randint(12, 30)
            misclick_rate = rng.uniform(0.02, 0.12)
            avg_click_interval_ms = rng.uniform(280, 620)
            avg_dwell_ms = rng.uniform(1200, 2600)
            rage_clicks = rng.randint(0, 1)
            zoom_events = rng.randint(0, 2)
            scroll_speed_px_s = rng.uniform(180, 360)
        elif profile == "risky":
            click_count = rng.randint(6, 20)
            misclick_rate = rng.uniform(0.12, 0.35)
            avg_click_interval_ms = rng.uniform(120, 360)
            avg_dwell_ms = rng.uniform(400, 1200)
            rage_clicks = rng.randint(1, 4)
            zoom_events = rng.randint(0, 2)
            scroll_speed_px_s = rng.uniform(320, 620)
        else:
            click_count = rng.randint(3, 12)
            misclick_rate = rng.uniform(0.35, 0.8)
            avg_click_interval_ms = rng.uniform(60, 180)
            avg_dwell_ms = rng.uniform(120, 600)
            rage_clicks = rng.randint(4, 10)
            zoom_events = rng.randint(0, 3)
            scroll_speed_px_s = rng.uniform(520, 980)

        rows.append(
            {
                "click_count": float(click_count),
                "misclick_rate": _clamp(misclick_rate, 0.0, 1.0),
                "avg_click_interval_ms": float(avg_click_interval_ms),
                "avg_dwell_ms": float(avg_dwell_ms),
                "rage_clicks": float(rage_clicks),
                "zoom_events": float(zoom_events),
                "scroll_speed_px_s": float(scroll_speed_px_s),
            }
        )

    return rows
