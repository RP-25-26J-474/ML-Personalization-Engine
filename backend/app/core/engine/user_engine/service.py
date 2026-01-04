from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any

import numpy as np

from app.core.schemas.interactions import InteractionBatch, EventsAgg
from app.core.schemas.trace import DecisionTrace, TraceAction
from app.core.storage.artifacts.artifact_store import ArtifactStore
from app.core.utils.ids import new_id
from app.core.engine.user_engine import seq_autoencoder


@dataclass
class UserResult:
    suggestion_dict: Dict[str, Any]
    confidence: float
    trace: DecisionTrace


class UserEngineService:
    """
    Demo: produce small delta suggestions based on interaction aggregates.
    Uses a GRU sequence autoencoder when available; falls back to heuristics.
    """

    def __init__(self, artifact_store: ArtifactStore | None = None):
        self.artifact_store = artifact_store or ArtifactStore()
        self._seq_bundle = self._load_seq_bundle()

    def _load_seq_bundle(self) -> seq_autoencoder.SeqModelBundle | None:
        try:
            return seq_autoencoder.load_bundle(self.artifact_store)
        except Exception:
            return None

    def reload_seq_model(self) -> None:
        self._seq_bundle = self._load_seq_bundle()

    def suggest(self, batch: InteractionBatch) -> UserResult:
        return self.suggest_many([batch])

    def suggest_many(self, batches: list[InteractionBatch]) -> UserResult:
        if not batches:
            raise ValueError("batches must not be empty")

        if self._seq_bundle:
            return self._suggest_seq_model(batches)

        agg_batch = self._aggregate_batches(batches)
        res = self._suggest_heuristic(agg_batch)
        batch_ids = [b.batch_id for b in batches]
        res.trace.inputs_summary["source_batch_ids"] = batch_ids
        res.trace.actions.insert(
            0,
            TraceAction(
                type="aggregate_batches",
                details={
                    "count": len(batches),
                    "batch_ids": batch_ids,
                    "weighting": "weighted_by_click_count_for_rates",
                },
            ),
        )
        return res

    def _suggest_seq_model(self, batches: list[InteractionBatch]) -> UserResult:
        sequence = np.stack(
            [seq_autoencoder.extract_feature_vector(b) for b in batches], axis=0
        )
        cluster_id, dist, similarity = seq_autoencoder.infer_cluster(
            self._seq_bundle, sequence
        )
        suggestion = self._seq_bundle.cluster_templates.get(cluster_id, {})
        confidence = 0.70 + 0.25 * similarity

        trace = DecisionTrace(
            trace_id=new_id("tr"),
            stage="user_engine",
            inputs_summary={
                "user_id": batches[0].user_id,
                "batch_id": batches[-1].batch_id,
                "source_batch_ids": [b.batch_id for b in batches],
            },
            actions=[
                TraceAction(
                    type="seq_model_encode",
                    details={
                        "sequence_len": len(batches),
                        "feature_order": seq_autoencoder.FEATURE_ORDER,
                    },
                ),
                TraceAction(
                    type="seq_model_cluster",
                    details={
                        "cluster_id": cluster_id,
                        "distance": dist,
                        "similarity": similarity,
                        "suggestion": suggestion,
                    },
                ),
            ],
            metrics={"confidence": float(min(1.0, confidence))},
            warnings=[],
        )

        return UserResult(
            suggestion_dict=suggestion,
            confidence=float(min(1.0, confidence)),
            trace=trace,
        )

    def _suggest_heuristic(self, batch: InteractionBatch) -> UserResult:
        e = batch.events_agg

        suggestion: Dict[str, Any] = {}

        # If many misclicks -> increase target size / spacing slightly
        if e.misclick_rate >= 0.15 or e.rage_clicks >= 2:
            suggestion["target_size"] = 32
            suggestion["element_spacing_x"] = 8
            suggestion["element_spacing_y"] = 4

        # If zoom events -> bigger font
        if e.zoom_events >= 2:
            suggestion["font_size"] = 14

        # If long dwell and high click interval -> maybe tooltip assist
        if e.avg_dwell_ms >= 3000 and e.avg_click_interval_ms >= 900:
            suggestion["tooltip_assist"] = True

        # Confidence increases with signal
        signal = min(
            1.0, (e.misclick_rate + 0.1 * e.zoom_events + 0.05 * e.rage_clicks)
        )
        confidence = 0.70 + 0.20 * signal

        trace = DecisionTrace(
            trace_id=new_id("tr"),
            stage="user_engine",
            inputs_summary={"user_id": batch.user_id, "batch_id": batch.batch_id},
            actions=[
                TraceAction(type="analyze_events_agg", details={"events_agg": e.model_dump()}),
                TraceAction(type="produce_suggestions", details={"suggestion": suggestion}),
            ],
            metrics={"confidence": float(min(1.0, confidence)), "signal": float(signal)},
            warnings=[],
        )

        return UserResult(
            suggestion_dict=suggestion,
            confidence=float(min(1.0, confidence)),
            trace=trace,
        )

    def _aggregate_batches(self, batches: list[InteractionBatch]) -> InteractionBatch:
        user_id = batches[0].user_id
        for batch in batches:
            if batch.user_id != user_id:
                raise ValueError("all batches must have same user_id")

        weights = [max(1, batch.events_agg.click_count) for batch in batches]

        def wavg(values: list[float], weights: list[int]) -> float:
            denom = float(sum(weights))
            if denom <= 0.0:
                return sum(values) / float(len(values))
            return sum(v * w for v, w in zip(values, weights)) / denom

        events = [batch.events_agg for batch in batches]
        events_agg = EventsAgg(
            click_count=sum(e.click_count for e in events),
            misclick_rate=wavg([e.misclick_rate for e in events], weights),
            avg_click_interval_ms=wavg([e.avg_click_interval_ms for e in events], weights),
            avg_dwell_ms=wavg([e.avg_dwell_ms for e in events], weights),
            rage_clicks=sum(e.rage_clicks for e in events),
            zoom_events=sum(e.zoom_events for e in events),
            scroll_speed_px_s=wavg([e.scroll_speed_px_s for e in events], weights),
        )

        last = batches[-1]
        return InteractionBatch(
            user_id=user_id,
            batch_id=new_id("agg"),
            captured_at=last.captured_at,
            page_context=last.page_context,
            events_agg=events_agg,
        )

    def train_seq_model(
        self,
        sequences: list[np.ndarray],
        max_len: int = 20,
        embedding_dim: int = 16,
        n_clusters: int | None = None,
        epochs: int = 30,
        learning_rate: float = 1e-3,
        batch_size: int = 16,
        seed: int = 42,
    ) -> dict:
        bundle = seq_autoencoder.train_seq_model(
            sequences=sequences,
            max_len=max_len,
            embedding_dim=embedding_dim,
            n_clusters=n_clusters,
            epochs=epochs,
            learning_rate=learning_rate,
            batch_size=batch_size,
            seed=seed,
        )
        seq_autoencoder.save_bundle(bundle, self.artifact_store)
        self._seq_bundle = bundle
        return {
            "n_sequences": len(sequences),
            "n_clusters": bundle.config["n_clusters"],
        }
