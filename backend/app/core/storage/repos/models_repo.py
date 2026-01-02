from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class ModelsRepo:
    # demo: store "versions" only; artifacts store actual objects on disk later
    global_iforest_version: str = "v0"
    user_seq_model_version: str = "v0"
    user_model_versions: Dict[str, str] = field(default_factory=dict)

    def set_user_model_version(self, user_id: str, version: str) -> None:
        self.user_model_versions[user_id] = version

    def get_user_model_version(self, user_id: str) -> Optional[str]:
        return self.user_model_versions.get(user_id)
