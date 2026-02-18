from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from sklearn.neighbors import NearestNeighbors

FEATURE_ORDER = [
    "vision_loss", "color_blindness",
    "delayed_reaction", "inaccurate_click",
    "literacy"
]

@dataclass
class KNNArtifacts:
    nn: NearestNeighbors
    X: np.ndarray                 # shape (n_samples, 5)
    profiles: list[dict]          # length n_samples, knob dicts
    feature_order: list[str] = None


def build_query_vector(impairment_probs: dict) -> np.ndarray:
    # impairment_probs is flattened dict with 5 keys
    return np.array([float(impairment_probs[k]) for k in FEATURE_ORDER], dtype=float)


def train_knn(X: np.ndarray, profiles: list[dict], k: int = 10, metric: str = "cosine") -> KNNArtifacts:
    nn = NearestNeighbors(n_neighbors=min(k, len(X)), metric=metric)
    nn.fit(X)
    return KNNArtifacts(nn=nn, X=X, profiles=profiles, feature_order=FEATURE_ORDER)
