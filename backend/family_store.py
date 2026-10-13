"""Server-side Firestore access using Google Application Default Credentials.

Ownership always comes from the verified backend session, never from a UID
provided by the browser. Firebase Authentication is not used.
"""
from datetime import datetime, timezone
from fastapi import HTTPException
from google.cloud import firestore


def timestamp():
    return datetime.now(timezone.utc).isoformat()


class FirestoreFamilyStore:
    def __init__(self, project_id):
        self.db = firestore.Client(project=project_id or None)

    def parent(self, uid):
        return self.db.collection("parents").document(uid)

    def children(self, uid):
        return self.parent(uid).collection("children")

    def child(self, uid, child_id):
        ref = self.children(uid).document(child_id)
        if not ref.get().exists:
            raise HTTPException(404, "Child not found")
        return ref

    def get_parent(self, uid):
        return self.parent(uid).get().to_dict()

    def save_parent(self, uid, name):
        ref = self.parent(uid)
        previous = ref.get().to_dict() or {}
        value = {"name": name, "createdAt": previous.get("createdAt", timestamp())}
        ref.set(value)
        return value

    def list_children(self, uid):
        values = [{**record.to_dict(), "id": record.id} for record in self.children(uid).stream()]
        return sorted(values, key=lambda item: item["createdAt"])

    def add_child(self, uid, name, age_range="6-9", language="sinhala"):
        if not self.parent(uid).get().exists:
            raise HTTPException(409, "Create parent profile first")
        ref = self.children(uid).document()
        ref.set({"name": name, "ageRange": age_range, "language": language, "createdAt": timestamp()})
        return {"id": ref.id}

    def rename_child(self, uid, child_id, name):
        self.child(uid, child_id).update({"name": name})
        return {"ok": True}

    def list_history(self, uid, child_id):
        return [{**record.to_dict(), "id": record.id} for record in self.child(uid, child_id).collection("history").stream()]

    def save_history(self, uid, child_id, value):
        ref = self.child(uid, child_id).collection("history").document()
        ref.set(value)
        return {"id": ref.id}

    def delete_history(self, uid, child_id, record_id):
        self.child(uid, child_id).collection("history").document(record_id).delete()

    def clear_history(self, uid, child_id):
        records = list(self.child(uid, child_id).collection("history").stream())
        for offset in range(0, len(records), 400):
            batch = self.db.batch()
            for record in records[offset:offset + 400]:
                batch.delete(record.reference)
            batch.commit()
