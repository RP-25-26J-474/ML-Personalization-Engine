from __future__ import annotations
import numpy as np
from sklearn.ensemble import IsolationForest


def new_iforest(contamination: float = 0.10) -> IsolationForest:
    return IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=42,
    )


def score_anomaly(model: IsolationForest, X: np.ndarray) -> float:
    """
    Return anomaly score in [0,1] where higher means more anomalous.
    IsolationForest gives decision_function (higher = more normal).
    """
    # decision_function: higher is better; convert to anomaly-like
    normality = float(model.decision_function(X.reshape(1, -1))[0])
    # Map to [0,1] with a simple squash (demo)
    # Typical normality values are around [-0.5, 0.5]
    score = 1.0 / (1.0 + pow(2.71828, 4 * normality))  # higher normality -> lower anomaly
    return float(max(0.0, min(1.0, score)))
