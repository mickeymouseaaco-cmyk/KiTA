# Firebase: connect, deploy, verify

This code is connected to your Firebase project **kita-4a2e1** (Singapore).
GitHub checks, uploads and tests everything for you, so you don't need a terminal.

## Automatic deploys (GitHub does it)

Every push to `main` runs the **Firebase** workflow (`.github/workflows/firebase.yml`):

1. **Check everything:** typecheck, lint, logic tests, rule tests, and an
   end-to-end run on the Firebase emulators.
2. **Upload:** Firestore rules and indexes, Storage rules, and the server
   functions, to `asia-southeast1` (Singapore).
3. **Test the live project:** `npm run verify:live` (section 5 below).

Steps 2 and 3 need one secret, set once:

1. Firebase console → ⚙️ **Project settings** → **Service accounts** →
   **Generate new private key** → **Generate key**. A `.json` file downloads.
2. Google Cloud console → **IAM** (project kita-4a2e1) → find
   `firebase-adminsdk-…@kita-4a2e1.iam.gserviceaccount.com` → ✏️ → **Add another
   role** → **Editor**, then **Add another role** → **Cloud Run Admin** → **Save**.
   (Editor uploads the functions; Cloud Run Admin lets the app call them.)
   Then, once, give Google's own services what the functions need (Editor can't
   grant roles): **IAM** → **Grant access**:
   - `service-210014850282@gcp-sa-pubsub.iam.gserviceaccount.com` → **Service Account Token Creator**
   - `210014850282-compute@developer.gserviceaccount.com` → **Cloud Run Invoker** and **Eventarc Event Receiver**
   - `service-210014850282@gcp-sa-firebasestorage.iam.gserviceaccount.com` → **Firebase Rules Firestore Service Agent**
     (Storage rules read the database to know who is a couple; without this, couple photos are refused.)
3. GitHub → KiTA → **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**. Name: `FIREBASE_SERVICE_ACCOUNT`. Value: open the
   `.json` file in Notepad/TextEdit, copy all of it, paste. **Add secret**.
4. GitHub → **Actions** → **Firebase** → **Run workflow**.

Keep the `.json` file private, and delete it from Downloads once it's in GitHub.
Without the secret, the workflow still runs step 1 and skips the rest.

The sections below are the same steps by hand, for running them on your own computer.

## 1. Settings (environment variables)

### The app: built in, or `.env` to override

Your project's web settings are already in `src/lib/firebase-config.ts`, so the
app, the website on Vercel and the live check need no variables. Set these only
to point a build at a different project (they win over the built-in values).
They come from Firebase console → Project settings → General → **Your apps** →
Web app → **Config**:

| Variable | Required | Where it comes from | Example |
|---|---|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | yes | `apiKey` | `AIzaSy…` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | yes | `authDomain` | `together-xyz.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | yes | `projectId` | `together-xyz` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | yes | `storageBucket` | `together-xyz.firebasestorage.app` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | yes | `messagingSenderId` | `123456789012` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | yes | `appId` | `1:1234…:web:ab12…` |
| `EXPO_PUBLIC_FUNCTIONS_REGION` | no | Leave unset: defaults to `asia-southeast1` (Singapore), where the functions are deployed | `asia-southeast1` |
| `EXPO_PUBLIC_RECAPTCHA_SITE_KEY` | no | App Check for the website (DEPLOY.md, step 5b) | `6Lc…` |
| `EXPO_PUBLIC_USE_EMULATORS` | no | `1` to run against local emulators instead | `1` |
| `EXPO_PUBLIC_EMULATOR_HOST` | no | Your computer's network address, when testing emulators from a phone | `192.168.1.20` |

These web values are meant to ship inside the app, which is why they are
committed; the security rules are what protect the data. If you do override them,
the same values go into **Vercel** (Settings → Environment Variables) and **EAS**
(`eas env:set`). `.env` is never committed.

| GitHub secret | Where it comes from |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the service-account key (Automatic deploys, above). Only GitHub uses it; never put it in the app or in Vercel. |

### The server functions: `functions/.env.kita-4a2e1`

Committed, so every deploy (GitHub included) has them. Change a value there and push.

| Parameter | Default | What it does |
|---|---|---|
| `REQUIRE_APP_CHECK` | `false` | `true` refuses pairing, unlink, reconnect and delete calls without a valid App Check token. Turn on only after App Check is set up for every platform. |
| `TRANSCRIBE_LANGUAGE` | `en-US` | Language for optional voice-note transcripts (for Malay, `ms-MY`). |

The functions need no keys or secrets: they run as your project's own service account.

## 2. Link this folder to your project (once)

```bash
npm install
npm --prefix functions install
npm --prefix firebase/tests install
npx --prefix firebase/tests firebase login
```

`.firebaserc` already points at `kita-4a2e1`.

## 3. Check everything locally first

```bash
npm run verify
```

This runs, in order: typecheck, lint, the logic tests, the functions build, the
security-rule tests, and an **end-to-end run against the Firebase emulators**
with the real rules and the real functions (`firebase/tests/integration.test.ts`).
It needs Java 11 or newer for the emulators.

## 4. Deploy

```bash
npx --prefix firebase/tests firebase deploy --only firestore,storage,functions
```

* **Functions region:** every function is deployed to `asia-southeast1` (Singapore),
  next to your database (`setGlobalOptions` in `functions/src/index.ts`). Firestore
  triggers must run in the database's region, so this has to match. Cloud
  Functions, Cloud Scheduler and Eventarc all support Singapore.
* The first deploy asks to enable a few Google Cloud APIs (Cloud Functions, Cloud
  Build, Artifact Registry, Eventarc, Cloud Scheduler). Say yes. It can take a few minutes.
* If it asks for `REQUIRE_APP_CHECK`, answer `false` for now.
* **Authentication → Settings → Authorized domains:** add your website's address
  (for example `kita.vercel.app`) so sign-in works there.

## 5. Check your live project

```bash
npm run verify:live
```

It uses the built-in settings (or your `.env`), creates three temporary accounts
(`together-check-…@example.com`), pairs two of them through the real `acceptInvite`
in Singapore, tests the rules from outside, then deletes all three with the real
`deleteAccount`. Nothing of yours is touched. Expected output ends with
**"All checks passed. Your Firebase project is ready."**

## What each check proves

| # | Requirement | Emulators (`npm run verify`) | Live (`npm run verify:live`) |
|---|---|---|---|
| 1 | Firebase initialises | each test user connects with the app's config | the app's config connects to kita-4a2e1 |
| 2 | Registration and sign-in | sign-up, profile and settings exactly as the app writes them; sign-in again | the same, on your project |
| 3 | Invite and linking | `acceptInvite` pairs; codes can't be reused; a paired person can't invite or be invited; nobody can pair by writing directly | `acceptInvite` pairs; reuse refused |
| 4 | Database structure matches the app | every couple, membership and profile field checked against what the app reads | couple fields checked |
| 5 | Firestore rules | private logs and profiles hidden from the partner; mood refused while switched off; another couple can't read, list or write anything | partner can't read your profile; a stranger can't read the couple; mood refused while off |
| 6 | Storage rules | partner can open your photo, another couple can't; private files hidden even from the partner; nobody uploads into your folder | the same for photos |
| 7 | Functions in Singapore | calls answer in `asia-southeast1` and not in `us-central1` | the same |
| 8 | Account deletion | profile, private logs, settings, photo, private files, memberships, the couple and every shared note removed; sign-in gone; the partner is unlinked and can pair again; the other couple is untouched | partner unlinked, couple gone, sign-in gone |
| 9 | Settings documented | this file, `.env.example` and `src/lib/firebase-config.ts` | missing settings are named before anything runs |

Also covered by the emulator run: unlinking cuts access at once, data is kept 30
days, and a reconnect needs both people.
