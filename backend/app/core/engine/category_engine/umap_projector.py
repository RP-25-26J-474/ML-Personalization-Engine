from __future__ import annotations
import numpy as np
import umap


def fit_umap(
    X: np.ndarray,
    n_components: int,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
):
    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        metric="cosine",
        random_state=random_state,
    )
    Z = reducer.fit_transform(X)
    return reducer, Z


def fit_umap_2d(
    X: np.ndarray,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
):
    return fit_umap(
        X,
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        random_state=random_state,
    )


def fit_umap_3d(
    X: np.ndarray,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
):
    return fit_umap(
        X,
        n_components=3,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        random_state=random_state,
    )
