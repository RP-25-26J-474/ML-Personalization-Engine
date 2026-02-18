from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class ModelsRepo:
    # demo: store "versions" only; artifacts store actual objects on disk later
    global_iforest_version: str = "v0"
    global_iforest_last_trained_at: str | None = None
    category_model_version: str = "v0"
    category_last_n_samples: int = 0
    category_last_trained_at: str | None = None
    user_seq_model_version: str = "v0"
    user_seq_n_clusters: int | None = None
    user_seq_embedding_dim: int | None = None
    user_seq_last_trained_at: str | None = None
    user_model_versions: Dict[str, str] = field(default_factory=dict)

    def set_user_model_version(self, user_id: str, version: str) -> None:
        self.user_model_versions[user_id] = version

    def get_user_model_version(self, user_id: str) -> Optional[str]:
        return self.user_model_versions.get(user_id)
