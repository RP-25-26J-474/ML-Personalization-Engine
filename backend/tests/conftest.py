from __future__ import annotations

import os
from pathlib import Path
import sys
import types


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ["MONGODB_URI"] = "mongodb://localhost:27017"
os.environ["MONGODB_DB_NAME"] = "mlpe_pytest"
os.environ["ARTIFACTS_DIR"] = str(Path("C:/tmp/mlpe-pytest-artifacts"))


class _FakeCollection:
    def create_index(self, *args, **kwargs):
        return None

    def find_one(self, *args, **kwargs):
        return None

    def update_one(self, *args, **kwargs):
        return types.SimpleNamespace(modified_count=0)

    def insert_one(self, *args, **kwargs):
        return types.SimpleNamespace(inserted_id="fake-id")

    def replace_one(self, *args, **kwargs):
        return types.SimpleNamespace(modified_count=1, upserted_id=None)

    def count_documents(self, *args, **kwargs):
        return 0

    def distinct(self, *args, **kwargs):
        return []

    def aggregate(self, *args, **kwargs):
        return []

    def find(self, *args, **kwargs):
        return _FakeCursor()


class _FakeCursor(list):
    def sort(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self


class _FakeDB:
    def collection(self, name: str):
        return _FakeCollection()


fake_db_module = types.ModuleType("app.core.storage.db")
fake_db_module.db = _FakeDB()
sys.modules["app.core.storage.db"] = fake_db_module
