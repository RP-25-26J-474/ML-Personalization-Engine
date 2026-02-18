from __future__ import annotations
import numpy as np
import umap
import warnings

warnings.filterwarnings(
    "ignore",
    message=".*force_all_finite.*renamed to.*ensure_all_finite.*",
    category=FutureWarning,
)


def fit_umap(
    X: np.ndarray,
    n_components: int,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
    n_jobs: int | None = None,
):
    n_samples = int(X.shape[0])
    if n_samples <= n_components:
        Z = np.zeros((n_samples, n_components), dtype=float)
        return None, Z
    safe_neighbors = min(n_neighbors, max(2, n_samples - 1))
    if random_state is not None and n_jobs is None:
        n_jobs = 1
    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=safe_neighbors,
        min_dist=min_dist,
        metric="cosine",
        random_state=random_state,
        n_jobs=n_jobs,
    )
    Z = reducer.fit_transform(X)
    return reducer, Z


def fit_umap_2d(
    X: np.ndarray,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
    n_jobs: int | None = None,
):
    return fit_umap(
        X,
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        random_state=random_state,
        n_jobs=n_jobs,
    )


def fit_umap_3d(
    X: np.ndarray,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
    n_jobs: int | None = None,
):
    return fit_umap(
        X,
        n_components=3,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        random_state=random_state,
        n_jobs=n_jobs,
    )
