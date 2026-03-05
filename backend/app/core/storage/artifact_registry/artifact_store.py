import os
import logging
import joblib
from app.core.config import settings


class ArtifactStore:
    def __init__(self, base_dir: str | None = None):
        self.base_dir = base_dir or settings.ARTIFACTS_DIR
        os.makedirs(self.base_dir, exist_ok=True)

    def save(self, key: str, obj) -> str:
        path = os.path.join(self.base_dir, f"{key}.joblib")
        dir_path = os.path.dirname(path)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)
        joblib.dump(obj, path)
        logging.getLogger(__name__).info("artifact.saved key=%s path=%s", key, path)
        return path

    def load(self, key: str):
        path = os.path.join(self.base_dir, f"{key}.joblib")
        if not os.path.exists(path):
            return None
        return joblib.load(path)
