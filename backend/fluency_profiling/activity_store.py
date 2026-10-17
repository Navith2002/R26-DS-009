"""Server-side Firestore access for the activity recommendation bank.

The "activities" collection lives in its own Firebase project
(final-sinhala-fluency), separate from the bhaasha-fdf3f project
family_store.py's FirestoreFamilyStore talks to -- so this uses its own
ACTIVITIES_FIRESTORE_PROJECT_ID / ACTIVITIES_GOOGLE_APPLICATION_CREDENTIALS
env vars and loads credentials explicitly (google.oauth2.service_account)
rather than relying on the process-wide GOOGLE_APPLICATION_CREDENTIALS env
var, which must stay pointed at the bhaasha-fdf3f key for that other flow.
"""
import os

import pandas as pd
from google.cloud import firestore
from google.oauth2 import service_account

# Firestore document fields -> the capitalized columns main.py's act_df
# consumers (get_recommendations, /activities endpoints) expect, matching
# activity_bank.csv's header exactly.
FIELD_TO_COLUMN = {
    "act_id":              "ACT_ID",
    "name":                "Name",
    "target_skill":        "Target_Skill",
    "difficulty":           "Difficulty",
    "description":         "Description",
    "reading_instruction": "reading_instruction",
    "sentence_source":     "sentence_source",
    "reading_mode":        "reading_mode",
}


def _client(project_id: str = None) -> firestore.Client:
    project_id = project_id or os.environ.get("ACTIVITIES_FIRESTORE_PROJECT_ID", "")
    key_path   = os.environ.get("ACTIVITIES_GOOGLE_APPLICATION_CREDENTIALS", "")
    if key_path and not os.path.isabs(key_path):
        key_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", key_path)

    credentials = (
        service_account.Credentials.from_service_account_file(key_path)
        if key_path else None
    )
    return firestore.Client(project=project_id or None, credentials=credentials)


def load_activities(project_id: str = None) -> pd.DataFrame:
    """Fetch the "activities" collection and return it as a DataFrame shaped
    like activity_bank.csv. Raises on any Firestore/connection error --
    callers should catch and fall back to the CSV."""
    db = _client(project_id)

    rows = []
    for doc in db.collection("activities").stream():
        data = doc.to_dict() or {}
        row = {column: data.get(field, "") for field, column in FIELD_TO_COLUMN.items()}
        rows.append(row)

    if not rows:
        raise RuntimeError("Firestore 'activities' collection is empty")

    return pd.DataFrame(rows, columns=list(FIELD_TO_COLUMN.values()))


def load_activity_sentence_map(project_id: str = None) -> dict:
    """Fetch the "activity_sentences" collection: {ACT_ID: [sentence_id, ...]},
    matching activity_sentences.csv's (ACT_ID, sentence_id) pairs grouped by
    activity. Raises on any Firestore/connection error."""
    db = _client(project_id)

    mapping = {}
    for doc in db.collection("activity_sentences").stream():
        data = doc.to_dict() or {}
        act_id = str(data.get("act_id", doc.id))
        sentence_ids = [str(sid) for sid in data.get("sentence_ids", [])]
        if sentence_ids:
            mapping[act_id] = sentence_ids

    if not mapping:
        raise RuntimeError("Firestore 'activity_sentences' collection is empty")

    return mapping


def load_sentences(project_id: str = None) -> dict:
    """Fetch the "sentences" collection: {sentence_id: {"text": ..., "length_class": ...}},
    matching ground_truth.csv's columns. Raises on any Firestore/connection error."""
    db = _client(project_id)

    sentences = {}
    for doc in db.collection("sentences").stream():
        data = doc.to_dict() or {}
        sentence_id = str(data.get("sentence_id", doc.id)).zfill(3)
        sentences[sentence_id] = {
            "text":         data.get("text", ""),
            "length_class": data.get("length_class", ""),
        }

    if not sentences:
        raise RuntimeError("Firestore 'sentences' collection is empty")

    return sentences
