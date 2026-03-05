from __future__ import annotations

from typing import Any

from app.core.storage.db import db
from app.core.utils.time import now_iso


class StateMachineRepo:
    def __init__(self) -> None:
        self._current = db.collection("state_machine_current")
        self._history = db.collection("state_machine_transitions")
        self._current.create_index([("machine", 1), ("entity_id", 1)], unique=True)
        self._history.create_index([("machine", 1), ("entity_id", 1), ("at", -1)])

    def get_current(self, machine: str, entity_id: str) -> str | None:
        doc = self._current.find_one({"machine": machine, "entity_id": entity_id})
        if not doc:
            return None
        return str(doc.get("state"))

    def init_if_missing(
        self,
        machine: str,
        entity_id: str,
        initial_state: str,
        actor: str,
        reason: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        now = now_iso()
        self._current.update_one(
            {"machine": machine, "entity_id": entity_id},
            {
                "$setOnInsert": {
                    "machine": machine,
                    "entity_id": entity_id,
                    "state": initial_state,
                    "updated_at": now,
                }
            },
            upsert=True,
        )
        self._history.update_one(
            {
                "machine": machine,
                "entity_id": entity_id,
                "from_state": None,
                "to_state": initial_state,
                "reason": reason,
            },
            {
                "$setOnInsert": {
                    "machine": machine,
                    "entity_id": entity_id,
                    "from_state": None,
                    "to_state": initial_state,
                    "actor": actor,
                    "reason": reason,
                    "metadata": metadata or {},
                    "at": now,
                }
            },
            upsert=True,
        )
        return self.get_current(machine, entity_id) or initial_state

    def transition(
        self,
        machine: str,
        entity_id: str,
        from_state: str,
        to_state: str,
        actor: str,
        reason: str,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        now = now_iso()
        res = self._current.update_one(
            {"machine": machine, "entity_id": entity_id, "state": from_state},
            {"$set": {"state": to_state, "updated_at": now}},
        )
        if res.modified_count == 0:
            return False

        self._history.insert_one(
            {
                "machine": machine,
                "entity_id": entity_id,
                "from_state": from_state,
                "to_state": to_state,
                "actor": actor,
                "reason": reason,
                "metadata": metadata or {},
                "at": now,
            }
        )
        return True

    def list_transitions(
        self, machine: str, entity_id: str, limit: int = 200
    ) -> list[dict[str, Any]]:
        docs = self._history.find(
            {"machine": machine, "entity_id": entity_id}
        ).sort([("at", -1)]).limit(limit)
        out: list[dict[str, Any]] = []
        for doc in docs:
            doc.pop("_id", None)
            out.append(doc)
        return out

