import json
import time
from dataclasses import replace
from types import SimpleNamespace

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from google.auth import crypt, jwt
from google.oauth2 import id_token

from google_accounts import AccountSettings, NONCE_COOKIE, PRIVACY_VERSION, SESSION_COOKIE, SessionStore, create_account_router

ORIGIN = "http://localhost:5173"
CLIENT_ID = "test-client.apps.googleusercontent.com"


class MemoryFamilyStore:
    def __init__(self):
        self.parents = {}
        self.children = {}
        self.histories = {}

    def get_parent(self, uid):
        return self.parents.get(uid)

    def save_parent(self, uid, name):
        self.parents[uid] = {"name": name, "createdAt": "today"}
        return self.parents[uid]

    def list_children(self, uid):
        return list(self.children.get(uid, {}).values())

    def add_child(self, uid, name):
        child_id = f"child-{len(self.children.get(uid, {})) + 1}"
        self.children.setdefault(uid, {})[child_id] = {"id": child_id, "name": name, "createdAt": "today"}
        return {"id": child_id}

    def require_child(self, uid, child_id):
        if child_id not in self.children.get(uid, {}):
            raise HTTPException(404, "Child not found")

    def rename_child(self, uid, child_id, name):
        self.require_child(uid, child_id)
        self.children[uid][child_id]["name"] = name
        return {"ok": True}

    def list_history(self, uid, child_id):
        self.require_child(uid, child_id)
        return list(self.histories.get((uid, child_id), {}).values())

    def save_history(self, uid, child_id, value):
        self.require_child(uid, child_id)
        records = self.histories.setdefault((uid, child_id), {})
        record_id = f"run-{len(records) + 1}"
        records[record_id] = {**value, "id": record_id}
        return {"id": record_id}

    def delete_history(self, uid, child_id, record_id):
        self.require_child(uid, child_id)
        self.histories.get((uid, child_id), {}).pop(record_id, None)

    def clear_history(self, uid, child_id):
        self.require_child(uid, child_id)
        self.histories[(uid, child_id)] = {}


@pytest.fixture
def system(tmp_path):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    public = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    signer = crypt.RSASigner.from_string(private, key_id="test-key")

    def certificate_request(url, method="GET", **kwargs):
        assert url.startswith("https://www.googleapis.com/")
        return SimpleNamespace(status=200, data=json.dumps({"test-key": public}).encode())

    def verify(token, audience):
        return id_token.verify_oauth2_token(token, certificate_request, audience)

    sessions = SessionStore(str(tmp_path / "sessions.sqlite3"))
    store = MemoryFamilyStore()
    settings = AccountSettings(google_client_id=CLIENT_ID, session_db=sessions.path, origins=(ORIGIN,))
    app = FastAPI()
    app.include_router(create_account_router(settings, store=store, sessions=sessions, verify_token=verify))
    client = TestClient(app, headers={"Origin": ORIGIN})

    def token(subject="google-parent-a", **overrides):
        challenge = client.get("/auth/nonce").json()["nonce"]
        now = int(time.time())
        claims = {"sub": subject, "aud": CLIENT_ID, "iss": "https://accounts.google.com", "iat": now, "exp": now + 3600, "email": "parent@example.test", "email_verified": True, "name": "Parent", "nonce": challenge, **overrides}
        return jwt.encode(signer, claims).decode()

    def login(subject="google-parent-a"):
        response = client.post("/auth/google", json=body(token(subject)))
        assert response.status_code == 200
        return response

    return SimpleNamespace(client=client, sessions=sessions, store=store, token=token, login=login, settings=settings, verify=verify)


def body(credential, **overrides):
    return {"credential": credential, "privacy_accepted": True, "privacy_version": PRIVACY_VERSION, **overrides}


def test_real_google_verifier_and_http_only_session(system):
    response = system.login()
    assert response.json()["uid"] == "google-parent-a"
    assert response.json()["newAccount"] is True
    cookie = response.headers.get_list("set-cookie")[0]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert system.client.get("/auth/session").json()["privacyVersion"] == PRIVACY_VERSION
    raw = system.client.cookies.get(SESSION_COOKIE)
    with system.sessions.connection() as db:
        assert db.execute("SELECT token_hash FROM sessions").fetchone()[0] == system.sessions.digest(raw)
    assert system.client.post("/auth/logout").status_code == 200
    assert system.client.get("/auth/session").status_code == 401
    assert system.sessions.user(raw) is None
    assert system.login().json()["newAccount"] is False


@pytest.mark.parametrize("overrides", [
    {"aud": "attacker-client"}, {"iss": "https://evil.example"},
    {"exp": 1}, {"email_verified": False}, {"sub": "bad/path"},
    {"nonce": "incorrect"},
])
def test_invalid_identity_claims_are_rejected(system, overrides):
    response = system.client.post("/auth/google", json=body(system.token(**overrides)))
    assert response.status_code in (401, 403)
    assert system.client.get("/auth/session").status_code == 401


def test_invalid_signature_is_rejected(system):
    token = system.token()
    parts = token.split(".")
    signature = parts[2]
    parts[2] = ("A" if signature[0] != "A" else "B") + signature[1:]
    assert system.client.post("/auth/google", json=body(".".join(parts))).status_code == 401


def test_nonce_is_single_use(system):
    token = system.token()
    nonce = system.client.cookies.get(NONCE_COOKIE)
    assert system.client.post("/auth/google", json=body(token)).status_code == 200
    system.client.cookies.set(NONCE_COOKIE, nonce, path="/auth")
    assert system.client.post("/auth/google", json=body(token)).status_code == 403


@pytest.mark.parametrize("change", [{"privacy_accepted": False}, {"privacy_version": "old"}])
def test_privacy_consent_is_required_before_account_creation(system, change):
    assert system.client.post("/auth/google", json=body(system.token(), **change)).status_code == 400
    with system.sessions.connection() as db:
        assert db.execute("SELECT count(*) FROM accounts").fetchone()[0] == 0


def test_cross_origin_mutations_are_denied(system):
    system.login()
    assert system.client.put("/family/parent", json={"name": "Attacker"}, headers={"Origin": "https://evil.example"}).status_code == 403
    assert system.client.post("/auth/logout", headers={"Origin": "https://evil.example"}).status_code == 403
    assert system.client.get("/auth/session").status_code == 200


def test_expired_or_absent_sessions_cannot_access_family_data(system):
    assert system.client.get("/family/children").status_code == 401
    system.login()
    with system.sessions.connection() as db:
        db.execute("UPDATE sessions SET expires_at = 1")
    assert system.client.get("/family/children").status_code == 401
    assert system.client.put("/family/parent", json={"name": "No"}).status_code == 401


def test_parent_and_child_isolation_and_history_deletion(system):
    client = system.client
    system.login()
    assert client.put("/family/parent", json={"name": " අම්මා "}).json()["name"] == "අම්මා"
    first = client.post("/family/children", json={"name": "අමල්"}).json()["id"]
    second = client.post("/family/children", json={"name": "නිමල්"}).json()["id"]
    record = {"kind": "reading", "createdAt": "2026-10-12", "payload": json.dumps({"result": {"accuracy": 90}})}
    first_path = f"/family/children/{first}/history"
    second_path = f"/family/children/{second}/history"
    one = client.post(first_path, json=record).json()["id"]
    client.post(second_path, json=record)
    assert client.delete(f"{first_path}/{one}").status_code == 200
    assert client.get(first_path).json() == []
    assert len(client.get(second_path).json()) == 1
    client.post(first_path, json=record)
    client.delete(first_path)
    assert client.get(first_path).json() == []
    assert len(client.get(second_path).json()) == 1
    client.post("/auth/logout")
    system.login("google-parent-b")
    assert client.get("/family/parent?uid=google-parent-a").json() is None
    assert client.get(first_path).status_code == 404
    assert client.delete(second_path).status_code == 404
    assert len(system.store.histories[("google-parent-a", second)]) == 1


def test_malformed_reports_and_blank_names_are_rejected(system):
    system.login()
    client = system.client
    assert client.put("/family/parent", json={"name": "   "}).status_code == 422
    client.put("/family/parent", json={"name": "Parent"})
    child = client.post("/family/children", json={"name": "Child"}).json()["id"]
    path = f"/family/children/{child}/history"
    assert client.post(path, json={"kind": "reading", "createdAt": "today", "payload": "not-json"}).status_code == 422
    assert client.post(path, json={"kind": "unknown", "createdAt": "today", "payload": "{}"}).status_code == 422
    assert client.post(path, json={"kind": "reading", "createdAt": "today", "payload": json.dumps({"text": "අ" * 300000}, ensure_ascii=False)}).status_code == 413


def test_production_cookie_flags_and_private_family_responses(system):
    app = FastAPI()
    app.include_router(create_account_router(replace(system.settings, secure_cookies=True), store=system.store, sessions=system.sessions, verify_token=system.verify))
    with TestClient(app, base_url="https://testserver", headers={"Origin": ORIGIN}) as client:
        nonce = client.get("/auth/nonce").json()["nonce"]
        token = system.token(nonce=nonce)
        response = client.post("/auth/google", json=body(token))
        assert response.status_code == 200
        cookie = response.headers.get_list("set-cookie")[0]
        assert "Secure" in cookie and "HttpOnly" in cookie
        assert client.get("/family/parent").headers["cache-control"] == "no-store"
