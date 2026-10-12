# Parent accounts and child history

The app uses Firebase Google authentication and Cloud Firestore. A parent's Google account owns named child profiles; children do not need Gmail addresses or passwords. The Google button creates an account on first sign-in and signs in returning parents. Sinhala is the default interface language; the existing toggle switches the whole interface to Tamil, including account screens and sign-out.

## Configure your Firebase project

1. Create a Firebase project and register a Web app.
2. Enable **Authentication → Sign-in method → Google** and configure its support email.
3. Add your development and deployed app hostnames to **Authentication → Settings → Authorized domains**. Add `localhost` explicitly for a new project if needed. Firebase's Google consent/account picker is provided by Google; its locale follows the requested language where supported.
4. Create a **Cloud Firestore** database. Deploy the repository's `firestore.rules` before using the application. Do not leave the database in test mode. With the Firebase CLI, from the repository root run `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.
5. Put the Web app configuration in your own `frontend/.env` (this file was not accessed during implementation):

```dotenv
VITE_FIREBASE_API_KEY=your_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_web_app_id
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Restart Vite after changing configuration. Firebase Web configuration is public client configuration, not a service-account secret. Do not put private keys, service-account JSON, or OAuth client secrets in `VITE_` variables. No Google client ID is needed separately when using Firebase's Google provider.

From `frontend`, run `npm ci --registry=https://registry.npmjs.org --replace-registry-host=always`, then `npm run dev`. Run `npm run build` for deployment. This fixes the existing Linux `ProfileSummary` filename import mismatch directly.

## Data and deletion

```
parents/{googleUid}                         { name, createdAt }
parents/{googleUid}/children/{childId}      { name, createdAt }
parents/{googleUid}/children/{childId}/history/{recordId}
                                           { kind, createdAt, payload }
```

`payload` is a JSON report string so model result arrays can be preserved without Firestore's nested-array restrictions. Reports include text, measurements and recommendations. Original photos, embedded line images, audio recordings, and temporary backend output links are not persisted. Oversized reports produce a localized error instead of silently dropping history. History is loaded through Firestore listeners and isolated by Google UID and selected child; old unscoped browser demo history is not automatically attributed to a child.

Parents can add and rename children, switch the active child, and delete a single result or all of that child's history across all four analysis types. Deleting a result deletes its Firestore document. Other children's records are unaffected. The app does not write student profiles to the analysis server: fluency requests send no `student_id`; returning dashboards use the selected child's private Firestore records. All-history deletion uses batches of 400 and surfaces failures; it applies to the records present when deletion starts.

Google sign-in persists using Firebase Auth's browser storage. Child history is not stored in the old shared localStorage keys; signing out or switching children clears visible report state. The interface language is the only reused browser preference. Rules restrict child data and history to their parent's Firebase UID.

The existing analysis backend remains a local development service with its existing public analysis/output endpoints. Firebase protects family records; it does not authenticate the Python analysis API. Before exposing that API publicly, add server-side Firebase token verification, restrict origins, and secure generated files. Model bundles still need to be installed separately for successful analysis.

## Verification

Run `npm test` for report serialization, localized account and deletion screens, and parent/child state isolation tests. `npm run test:rules` starts the Firestore emulator and runs the real rules/persistence tests. The rules tests require a Firestore emulator on port 8080 (or start it manually with `firebase emulators:start --only firestore --project demo-writebright`); without it they are explicitly skipped. These tests use a demo project and do not access real accounts or `.env`.

After configuring a real project, verify: sign in with Google; enter a parent name and first child's name; add a second child; complete an analysis for each; reload and sign in again to confirm persistence; switch languages on both account and analysis screens; delete a result and all history for one child; confirm the other child's history remains; sign out and use a different parent account to verify isolation.

During implementation the production build and local tests ran with environment-file loading disabled. Live Google sign-in requires your project configuration. The cloud machine blocked the emulator download from `storage.googleapis.com`; emulator tests are provided but were not executed here. If testing inside a restricted cloud environment, allow that host for the emulator download and your Firebase/Google authentication endpoints for live sign-in.
