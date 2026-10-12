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

from google_accounts import AccountSettings, NONCE_COOKIE, PRIVACY_VERSION, SESSION_COOKIE, SessionStore, create_account_router, verify_google_credential

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

    def add_child(self, uid, name, age_range="6-9", language="sinhala"):
        child_id = f"child-{len(self.children.get(uid, {})) + 1}"
        self.children.setdefault(uid, {})[child_id] = {"id": child_id, "name": name, "ageRange": age_range, "language": language, "createdAt": "today"}
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
        return verify_google_credential(token, audience, certificate_request)

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
        if response.json()["needsPrivacyConsent"]:
            assert client.post("/auth/privacy", json=policy()).status_code == 200
        return response

    return SimpleNamespace(client=client, sessions=sessions, store=store, token=token, login=login, settings=settings, verify=verify)


def body(credential, **overrides):
    return {"credential": credential, **overrides}


def policy(**overrides):
    return {"privacy_accepted": True, "privacy_version": PRIVACY_VERSION, **overrides}


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
    assert system.client.post("/auth/google", json=body(system.token())).status_code == 200
    assert system.client.post("/auth/privacy", json=policy(**change)).status_code == 400
    assert system.client.get("/family/children").status_code == 403
    with system.sessions.connection() as db:
        assert db.execute("SELECT accepted_at FROM accounts").fetchone()[0] == 0


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
        assert client.post("/auth/privacy", json=policy()).status_code == 200
        assert client.get("/family/parent").headers["cache-control"] == "no-store"


@pytest.mark.parametrize("overrides,code", [
    ({"aud": "wrong-client"}, "google_client_mismatch"),
    ({"exp": 1}, "google_token_expired"),
    ({"iat": int(time.time()) + 120}, "google_clock_error"),
])
def test_verification_failures_have_safe_actionable_reasons(system, overrides, code, caplog):
    token = system.token(**overrides)
    response = system.client.post("/auth/google", json=body(token))
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == code
    assert token not in caplog.text
    assert "parent@example.test" not in caplog.text
    assert CLIENT_ID not in caplog.text


def test_small_clock_skew_does_not_block_a_fresh_valid_google_token(system):
    response = system.client.post("/auth/google", json=body(system.token(iat=int(time.time()) + 15)))
    assert response.status_code == 200


def test_google_key_fetch_failure_is_not_reported_as_bad_credentials(system, caplog):
    from google.auth.exceptions import TransportError
    def unavailable(token, audience):
        raise TransportError("secret transport details")
    app = FastAPI()
    app.include_router(create_account_router(system.settings, store=system.store, sessions=system.sessions, verify_token=unavailable))
    with TestClient(app, headers={"Origin": ORIGIN}) as client:
        response = client.post("/auth/google", json=body("private-token"))
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "google_verification_unavailable"
    assert "private-token" not in caplog.text
    assert "secret transport details" not in caplog.text


def test_first_signup_and_returning_login_have_different_consent_states(system):
    client = system.client
    first = client.post("/auth/google", json=body(system.token()))
    assert first.json()["needsPrivacyConsent"] is True
    assert client.get("/family/children").status_code == 403
    assert client.put("/family/parent", json={"name": "Parent"}).status_code == 403
    accepted = client.post("/auth/privacy", json=policy())
    assert accepted.json()["needsPrivacyConsent"] is False
    accepted_at = accepted.json()["privacyAcceptedAt"]
    assert client.put("/family/parent", json={"name": "Parent"}).status_code == 200
    client.post("/auth/logout")
    returning = client.post("/auth/google", json=body(system.token()))
    assert returning.json()["needsPrivacyConsent"] is False
    assert returning.json()["privacyAcceptedAt"] == accepted_at
    assert client.get("/family/parent").status_code == 200


def test_child_age_and_language_are_saved_and_invalid_options_rejected(system):
    system.login()
    client = system.client
    client.put("/family/parent", json={"name": "Parent"})
    created = client.post("/family/children", json={"name": "Child", "ageRange": "10-12", "language": "tamil"})
    assert created.status_code == 200
    child = client.get("/family/children").json()[0]
    assert child["ageRange"] == "10-12" and child["language"] == "tamil"
    assert client.post("/family/children", json={"name": "Bad", "language": "english"}).status_code == 422


def test_signing_out_before_acceptance_does_not_turn_an_unfinished_signup_into_a_returning_account(system):
    first = system.client.post("/auth/google", json=body(system.token()))
    assert first.json()["needsPrivacyConsent"] is True
    system.client.post("/auth/logout")
    again = system.client.post("/auth/google", json=body(system.token()))
    assert again.json()["needsPrivacyConsent"] is True
    assert system.client.get("/family/children").status_code == 403
