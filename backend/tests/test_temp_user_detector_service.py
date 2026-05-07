from __future__ import annotations

from app.core.engine.temp_user_detector.service import TempUserDetectorService
from app.core.schemas.interactions import EventsAgg, InteractionBatch


class FakeArtifactStore:
    base_dir = "unused"

    def __init__(self) -> None:
        self.saved: dict[str, object] = {}

    def load(self, key: str):
        return None

    def save(self, key: str, obj):
        self.saved[key] = obj
        return key


class FakeBaselineRepo:
    def __init__(self, baseline: list[float] | None = None) -> None:
        self.baseline = baseline
        self.updates: list[tuple[str, list[float]]] = []

    def get(self, user_id: str):
        return self.baseline

    def update(self, user_id: str, features: list[float]) -> None:
        self.updates.append((user_id, features))


def make_batch(batch_id: str, **event_overrides) -> InteractionBatch:
    events = {
        "click_count": 20,
        "misclick_rate": 0.05,
        "avg_click_interval_ms": 420.0,
        "avg_dwell_ms": 1800.0,
        "rage_clicks": 0,
        "zoom_events": 1,
        "scroll_speed_px_s": 260.0,
    }
    events.update(event_overrides)
    return InteractionBatch(
        user_id="user-1",
        batch_id=batch_id,
        captured_at="2026-05-07T10:00:00+00:00",
        events_agg=EventsAgg(**events),
    )


def make_service() -> TempUserDetectorService:
    return TempUserDetectorService(
        artifact_store=FakeArtifactStore(),
        baseline_repo=FakeBaselineRepo(),
    )


def test_score_batch_keeps_low_risk_batch_with_heuristic_fallback():
    service = make_service()

    result = service.score_batch(make_batch("safe-batch"))

    assert result.outcome == "keep"
    assert result.is_quarantined is False
    assert result.is_rejected is False
    assert result.reason is None
    assert result.features == [20.0, 0.05, 420.0, 1800.0, 0.0, 1.0, 260.0]
    assert result.trace.stage == "temp_user_filter"
    assert result.trace.actions[-1].type == "keep"


def test_score_batch_rejects_high_anomaly_batch_with_heuristic_fallback():
    service = make_service()

    result = service.score_batch(
        make_batch(
            "risky-batch",
            misclick_rate=1.0,
            rage_clicks=6,
            avg_click_interval_ms=150.0,
            avg_dwell_ms=300.0,
            scroll_speed_px_s=900.0,
        )
    )

    assert result.outcome == "reject"
    assert result.is_quarantined is True
    assert result.is_rejected is True
    assert result.reason == "high_anomaly_score_reject"
    assert result.anomaly_score >= service.reject_threshold
    assert result.trace.actions[-1].type == "reject"


def test_score_batches_preserves_input_order():
    service = make_service()
    batches = [
        make_batch("batch-1"),
        make_batch("batch-2", misclick_rate=1.0, rage_clicks=6, avg_click_interval_ms=150.0, avg_dwell_ms=300.0),
    ]

    results = service.score_batches(batches)

    assert [result.trace.inputs_summary["batch_id"] for result in results] == [
        "batch-1",
        "batch-2",
    ]
    assert [result.outcome for result in results] == ["keep", "reject"]
