# Direct Google sign-in, parent accounts, and private child history

Authentication uses **Google Identity Services directly**, not Firebase Authentication. The browser sends Google's signed ID token to the Python backend, which verifies its signature, Google issuer, expiry, audience, verified email, and a single-use sign-in nonce. The backend issues an opaque HTTP-only session cookie. First-time identities must then accept the privacy note through `/auth/privacy` before family-data endpoints are available. Returning parents with recorded acceptance skip this step. No Google tokens or application session tokens are stored in browser localStorage.

Firestore is used only for family profiles and learning history, through the Python backend's Google Cloud credentials. The browser does not connect to Firestore. Parents own named child profiles; children do not need Gmail addresses or passwords.

## Google sign-in configuration

1. In Google Cloud Console, configure the OAuth consent screen and create an **OAuth 2.0 Client ID → Web application**. Add the frontend origin (for development, `http://localhost:5173`, and optionally `http://127.0.0.1:5173`) to **Authorized JavaScript origins**. Add the production frontend origin when deploying. Configure test users if your consent screen is in testing mode.
2. Put the same client ID in your own configuration files. No OAuth client secret is required for this Google ID-token flow.

`frontend/.env`:

```dotenv
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
# Leave empty when using the Vite development proxy or a same-origin production proxy.
VITE_ACCOUNT_API_BASE_URL=
VITE_API_BASE_URL=http://127.0.0.1:8000
```

`backend/.env`:

```dotenv
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
FIRESTORE_PROJECT_ID=your_google_cloud_project_id
GOOGLE_APPLICATION_CREDENTIALS=/absolute/private/path/to/firestore-service-account.json
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
SESSION_COOKIE_SECURE=false
# Optional: default is backend/.sessions/accounts.sqlite3.
# ACCOUNT_SESSION_DB=/private/persistent/path/accounts.sqlite3
```

Neither `.env` file nor any credential file was accessed during implementation. Client IDs are public identifiers. Service-account JSON belongs only on the server; never put private keys or service-account details in `VITE_` variables, the repository, or chat.

## Firestore storage

Create a Firestore database in the selected Google Cloud project. Provide the backend with Application Default Credentials: a deployment workload identity/service account with Firestore access, or for local development a private service-account file referenced by `GOOGLE_APPLICATION_CREDENTIALS`. Grant only the needed Firestore data permissions (for example `roles/datastore.user`). Deploy `firestore.rules` using the database's Rules panel or the Firebase CLI. These rules deny every browser read/write; the backend uses Google Cloud IAM instead of Firebase Authentication.

Data paths remain `parents/{googleSubject}/children/{childId}/history/{recordId}`. The parent identifier is Google's verified `sub`, not a Firebase UID and not an email address. Existing records previously saved under Firebase UIDs are preserved but require an explicit administrative migration to Google subject IDs; this implementation does not silently reassign them.

Histories contain report text, measurements, and recommendations. Original photos, embedded line images, audio, and temporary output URLs are excluded from Firestore reports. Analysis inputs and generated files may still remain on the existing analysis server; deleting a Firestore report does not remove those files. History deletion supports individual reports and all reports for the selected child, using batches of 400 on the server. Other children's reports are unaffected. Child data is authorized from the backend session; browser-supplied parent IDs are never trusted.

## Run

From `backend`, install requirements, then run `python -m uvicorn app:app --host 127.0.0.1 --port 8000`. From `frontend`, run `npm ci --registry=https://registry.npmjs.org --replace-registry-host=always`, then `npm run dev`. Restart both after editing their configuration.

Vite proxies `/auth` and `/family` to the backend, keeping cookies on the frontend origin in development. Keep these routes on the same origin behind your production reverse proxy, or use same-site HTTPS frontend/backend hosts and configure `VITE_ACCOUNT_API_BASE_URL` and `FRONTEND_ORIGINS` accordingly. Cross-site hosting is not supported by the session cookie's `SameSite=Lax` policy. Set `SESSION_COOKIE_SECURE=true` in production and use HTTPS. Persist the private session database, which contains hashed session tokens, parent identity metadata, and privacy-consent records. Session lifetime is 12 hours; logout invalidates the server session.

The existing analysis API remains a separate local service. Family/history endpoints enforce the Google session; existing analysis/output endpoints have their original access behavior. Secure analysis endpoints and uploaded-file retention before publicly exposing that service.

## Privacy and language

Sinhala is the default, and the shared switcher changes account screens, consent, privacy notes, and sign-out to Tamil. Google's own sign-in widget receives the selected locale; provider-controlled screens use the locales Google supports.

The flow follows the supplied videos: welcome and direct Google sign-in → first-signup policy (new parents only) → child picker/creation → the child app. Google identity is verified before any private child list is shown. The welcome page includes an optional policy link, without a consent checkbox. For a new parent, a full policy and parent/guardian acknowledgement appear after Google identification and before family-profile creation. Acceptance is persisted in the private session database; future logins skip the policy. No policy or signup notice is repeated on the profile page.

Every new or restored parent session starts at child selection; the first child is never selected automatically. Existing child buttons enter that child's app. The same chooser can create a new child with name, age range (6–9, 10–12, or 13–16), and Sinhala/Tamil language. The child's preferred language is applied on entry. Parent names come from the verified Google profile. The profile page shows parent and child account summaries only: no add-child form, editable fields, signup notice, or Save buttons. Older child documents lacking age/language remain readable and are shown without invented values.

The full `/privacy` page stays accessible before sign-in. Supply your actual administrator contact and review your deployed retention policy before publishing; the note describes current behavior and does not claim legal certification.

## Verification

From `frontend`, run `npm test` and `npm run build`. From `backend`, run `python -m pytest tests/test_google_accounts.py -q`. Backend tests use locally signed test tokens and mocked Google public-key responses to exercise the real Google verifier, plus isolated session databases and an in-memory family store. They do not load `.env` or access live Google/Firestore accounts.

Live verification still requires your real Google client ID, authorized origins, and backend Firestore credentials: sign in, create two children, save reports, reload, switch children, delete one child's history, verify the other child's data, and sign out. Restricted network environments must allow `accounts.google.com`, `www.googleapis.com` (Google ID-token signing certificates), and your Google Cloud Firestore/credential endpoints.

## Diagnose a rejected returning sign-in

`GET /auth/session` returning 401 while signed out is normal. `POST /auth/google` returning 401 means a Google credential was rejected. The backend logs only a safe reason code, never the token or personal information:

- `google_client_mismatch`: use the same Web client ID in frontend and backend, then restart both. The sign-in widget also checks this before opening Google.
- `google_clock_error`: synchronize the backend machine's clock. A 30-second tolerance supports small differences on newly issued tokens; signatures and expiration remain checked.
- `google_token_expired` or `google_challenge_expired`: make a fresh Google sign-in attempt.
- `google_verification_unavailable` (503): the backend cannot verify with Google's signing-key service. Check connectivity to `www.googleapis.com`, trusted certificates, and any firewall/proxy. Never disable TLS verification.
- `google_credential_invalid` or `google_account_unverified`: the returned token or Google account did not pass verification.

Returning parents use the same Google sign-in button and their original verified Google identity. They do not need to create a second parent account. Share only the reason code when troubleshooting, not Google credentials, cookies or .env contents.
