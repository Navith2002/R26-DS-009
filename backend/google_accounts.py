"""Direct Google ID-token verification, opaque sessions, and family-data API.

This module never loads .env files. app.py owns normal runtime configuration;
standalone tests can supply settings, a verifier, and a family store explicitly.
"""
from contextlib import contextmanager
import hashlib
import logging
import os
import re
import secrets
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from google.auth import exceptions as google_errors
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from pydantic import BaseModel, Field, StrictBool

logger = logging.getLogger("uvicorn.error")


def verify_google_credential(credential, audience, request=None):
    if request is None:
        transport = GoogleRequest()
        def request(url, **kwargs):
            kwargs.setdefault("timeout", 10)
            return transport(url, **kwargs)
    # Google's verifier supports small clock differences for freshly issued
    # tokens. Signature, issuer, audience and the final expiry check remain.
    return id_token.verify_oauth2_token(credential, request, audience, clock_skew_in_seconds=30)


def reject_google(code, status=401):
    # Log only an allowlisted reason, never the token, email, client ID or
    # underlying exception (which can contain credential material).
    logger.warning("Google sign-in rejected: %s", code)
    raise HTTPException(status, detail={"code": code})


PRIVACY_VERSION = "1"
SESSION_COOKIE = "writebright_session"
NONCE_COOKIE = "writebright_google_nonce"


@dataclass(frozen=True)
class AccountSettings:
    google_client_id: str
    firestore_project_id: str = ""
    session_db: str = str(Path(__file__).parent / ".sessions" / "accounts.sqlite3")
    origins: tuple = ("http://localhost:5173", "http://127.0.0.1:8000")
    secure_cookies: bool = False
    session_ttl: int = 43200

    @classmethod
    def from_environment(cls):
        return cls(
            google_client_id=os.environ.get("GOOGLE_CLIENT_ID", "").strip(),
            firestore_project_id=os.environ.get("FIRESTORE_PROJECT_ID", ""),
            session_db=os.environ.get("ACCOUNT_SESSION_DB", cls.session_db),
            origins=tuple(value.strip() for value in os.environ.get("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if value.strip()),
            secure_cookies=os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true",
            session_ttl=43200,
        )


class SessionStore:
    def __init__(self, path):
        self.path = path
        directory = Path(path).parent
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        with self.connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS accounts (
                    subject TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
                    privacy_version TEXT NOT NULL, accepted_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY, subject TEXT NOT NULL,
                    expires_at INTEGER NOT NULL, new_account INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS nonces (
                    nonce_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
                );
            """)
        os.chmod(path, 0o600)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def digest(value):
        return hashlib.sha256(value.encode()).hexdigest()

    def nonce(self):
        value = secrets.token_urlsafe(32)
        with self.connection() as db:
            now = int(time.time())
            db.execute("DELETE FROM nonces WHERE expires_at <= ?", (now,))
            db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
            db.execute("INSERT INTO nonces VALUES (?, ?)", (self.digest(value), now + 300))
        return value

    def consume_nonce(self, value):
        with self.connection() as db:
            result = db.execute("DELETE FROM nonces WHERE nonce_hash = ? AND expires_at > ?", (self.digest(value), int(time.time())))
            return result.rowcount == 1

    def login(self, claims, ttl):
        token = secrets.token_urlsafe(48)
        now = int(time.time())
        with self.connection() as db:
            previous = db.execute("SELECT privacy_version, accepted_at FROM accounts WHERE subject = ?", (claims["sub"],)).fetchone()
            new_account = previous is None or previous["privacy_version"] != PRIVACY_VERSION or previous["accepted_at"] <= 0
            db.execute("""INSERT INTO accounts VALUES (?, ?, ?, '', 0)
                ON CONFLICT(subject) DO UPDATE SET name=excluded.name, email=excluded.email""",
                (claims["sub"], claims.get("name", ""), claims.get("email", "")))
            db.execute("INSERT INTO sessions VALUES (?, ?, ?, ?)", (self.digest(token), claims["sub"], now + ttl, int(new_account)))
        return token, self.user(token)

    def user(self, token):
        if not token:
            return None
        with self.connection() as db:
            row = db.execute("""SELECT accounts.*, sessions.new_account FROM sessions
                JOIN accounts ON accounts.subject = sessions.subject
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?""", (self.digest(token), int(time.time()))).fetchone()
        if not row:
            return None
        return {"uid": row["subject"], "displayName": row["name"], "email": row["email"], "privacyVersion": row["privacy_version"], "privacyAcceptedAt": row["accepted_at"], "newAccount": bool(row["new_account"]), "needsPrivacyConsent": row["privacy_version"] != PRIVACY_VERSION or row["accepted_at"] <= 0}

    def accept_privacy(self, subject):
        with self.connection() as db:
            db.execute("UPDATE accounts SET privacy_version = ?, accepted_at = ? WHERE subject = ?", (PRIVACY_VERSION, int(time.time()), subject))

    def logout(self, token):
        if token:
            with self.connection() as db:
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (self.digest(token),))


class GoogleLogin(BaseModel):
    credential: str = Field(min_length=1, max_length=10000)


class PrivacyAcceptance(BaseModel):
    privacy_accepted: StrictBool
    privacy_version: str


class NamedProfile(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ChildProfile(NamedProfile):
    ageRange: Literal["6-9", "10-12", "13-16"] = "6-9"
    language: Literal["sinhala", "tamil"] = "sinhala"


class HistoryRecord(BaseModel):
    # "fluencyPlan" is the fluency-profiling component's own practice-plan
    # record (see frontend/src/context/AppContext.jsx's createFluencyPlan) --
    # additive only, the other 4 kinds are unchanged.
    kind: Literal["handwriting", "grammar", "fluency", "reading", "fluencyPlan"]
    createdAt: str = Field(min_length=1, max_length=40)
    payload: str = Field(max_length=800000)


def create_account_router(settings=None, store=None, verify_token=None, sessions=None):
    settings = settings or AccountSettings.from_environment()
    sessions = sessions or SessionStore(settings.session_db)
    def private_response(response: Response):
        response.headers['Cache-Control'] = 'no-store'
    router = APIRouter(dependencies=[Depends(private_response)])

    def origin_check(request: Request):
        if request.headers.get("origin") not in settings.origins:
            raise HTTPException(403, "Origin not allowed")

    def current_user(request: Request):
        user = sessions.user(request.cookies.get(SESSION_COOKIE))
        if not user:
            raise HTTPException(401, "Sign in required")
        return user

    def registered_user(user=Depends(current_user)):
        if user["needsPrivacyConsent"]:
            raise HTTPException(403, detail={"code": "privacy_required"})
        return user

    def family_store():
        nonlocal store
        if store is None:
            from family_store import FirestoreFamilyStore
            try:
                store = FirestoreFamilyStore(settings.firestore_project_id)
            except Exception:
                raise HTTPException(503, "History storage is not configured") from None
        return store

    def valid_name(profile):
        name = profile.name.strip()
        if not name:
            raise HTTPException(422, "Name required")
        return name

    @router.get("/auth/nonce")
    def nonce(response: Response):
        if not settings.google_client_id:
            raise HTTPException(503, "Google sign-in is not configured")
        value = sessions.nonce()
        response.set_cookie(NONCE_COOKIE, value, max_age=300, httponly=True, secure=settings.secure_cookies, samesite="lax", path="/auth")
        response.headers["Cache-Control"] = "no-store"
        return {"nonce": value, "client_id": settings.google_client_id}

    @router.post("/auth/google", dependencies=[Depends(origin_check)])
    def google_login(body: GoogleLogin, request: Request, response: Response):
        if not settings.google_client_id:
            raise HTTPException(503, "Google sign-in is not configured")
        try:
            claims = (verify_token or verify_google_credential)(body.credential, settings.google_client_id)
        except google_errors.TransportError:
            reject_google("google_verification_unavailable", 503)
        except (google_errors.GoogleAuthError, ValueError) as error:
            message = str(error)
            if message.startswith("Token has wrong audience"):
                reject_google("google_client_mismatch")
            if message.startswith("Token expired"):
                reject_google("google_token_expired")
            if message.startswith("Token used too early"):
                reject_google("google_clock_error")
            reject_google("google_credential_invalid")
        except Exception:
            reject_google("google_verification_unavailable", 503)
        if claims.get("aud") != settings.google_client_id:
            reject_google("google_client_mismatch")
        if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            reject_google("google_credential_invalid")
        if claims.get("exp", 0) <= time.time():
            reject_google("google_token_expired")
        if not isinstance(claims.get("sub"), str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", claims["sub"]) or claims.get("email_verified") is not True:
            reject_google("google_account_unverified")
        cookie_nonce = request.cookies.get(NONCE_COOKIE)
        if not cookie_nonce or not secrets.compare_digest(str(claims.get("nonce", "")), cookie_nonce) or not sessions.consume_nonce(cookie_nonce):
            reject_google("google_challenge_expired", 403)
        # Rotate any previous browser session when a parent signs in.
        sessions.logout(request.cookies.get(SESSION_COOKIE))
        token, user = sessions.login(claims, settings.session_ttl)
        response.set_cookie(SESSION_COOKIE, token, max_age=settings.session_ttl, httponly=True, secure=settings.secure_cookies, samesite="lax", path="/")
        response.delete_cookie(NONCE_COOKIE, path="/auth", secure=settings.secure_cookies, httponly=True, samesite="lax")
        response.headers["Cache-Control"] = "no-store"
        return user

    @router.get("/auth/session")
    def session(response: Response, user=Depends(current_user)):
        response.headers["Cache-Control"] = "no-store"
        return user

    @router.post("/auth/logout", dependencies=[Depends(origin_check)])
    def logout(request: Request, response: Response):
        sessions.logout(request.cookies.get(SESSION_COOKIE))
        response.delete_cookie(SESSION_COOKIE, path="/", secure=settings.secure_cookies, httponly=True, samesite="lax")
        return {"ok": True}

    @router.post("/auth/privacy", dependencies=[Depends(origin_check)])
    def accept_privacy(body: PrivacyAcceptance, request: Request, response: Response, user=Depends(current_user)):
        if not body.privacy_accepted or body.privacy_version != PRIVACY_VERSION:
            raise HTTPException(400, "Current privacy notice must be accepted")
        sessions.accept_privacy(user["uid"])
        return sessions.user(request.cookies.get(SESSION_COOKIE))

    @router.get("/family/parent")
    def parent(user=Depends(registered_user)):
        return family_store().get_parent(user["uid"])

    @router.put("/family/parent", dependencies=[Depends(origin_check)])
    def save_parent(body: NamedProfile, user=Depends(registered_user)):
        return family_store().save_parent(user["uid"], valid_name(body))

    @router.get("/family/children")
    def children(user=Depends(registered_user)):
        return family_store().list_children(user["uid"])

    @router.post("/family/children", dependencies=[Depends(origin_check)])
    def add_child(body: ChildProfile, user=Depends(registered_user)):
        return family_store().add_child(user["uid"], valid_name(body), body.ageRange, body.language)

    @router.patch("/family/children/{child_id}", dependencies=[Depends(origin_check)])
    def rename_child(child_id: str, body: NamedProfile, user=Depends(registered_user)):
        return family_store().rename_child(user["uid"], child_id, valid_name(body))

    @router.get("/family/children/{child_id}/history")
    def history(child_id: str, user=Depends(registered_user)):
        return family_store().list_history(user["uid"], child_id)

    @router.post("/family/children/{child_id}/history", dependencies=[Depends(origin_check)])
    def save_history(child_id: str, body: HistoryRecord, user=Depends(registered_user)):
        if len(body.payload.encode("utf-8")) > 800000:
            raise HTTPException(413, "Report too large")
        import json
        try:
            decoded = json.loads(body.payload)
            if not isinstance(decoded, dict):
                raise ValueError()
        except ValueError:
            raise HTTPException(422, "Invalid report") from None
        return family_store().save_history(user["uid"], child_id, body.model_dump())

    @router.delete("/family/children/{child_id}/history", dependencies=[Depends(origin_check)])
    def clear_history(child_id: str, user=Depends(registered_user)):
        family_store().clear_history(user["uid"], child_id)
        return {"ok": True}

    @router.delete("/family/children/{child_id}/history/{record_id}", dependencies=[Depends(origin_check)])
    def delete_history(child_id: str, record_id: str, user=Depends(registered_user)):
        family_store().delete_history(user["uid"], child_id, record_id)
        return {"ok": True}

    return router
