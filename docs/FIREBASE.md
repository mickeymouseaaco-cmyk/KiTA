# Firebase: connect, deploy, verify

Your console setup (web app, Authentication, Firestore, Storage, Blaze, Singapore)
is the starting point. These steps connect this code to that project, deploy
the rules and functions, and prove it works. Run them on your computer, in
this folder.

## 1. Settings (environment variables)

### The app: `.env` (copy from `.env.example`)

Firebase console → Project settings → General → **Your apps** → your Web app →
*SDK setup and configuration* → **Config**. Copy each value across:

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

These web values are meant to ship inside the app; the security rules are what
protect the data. The same values go into **Vercel** (Settings → Environment
Variables) and **EAS** (`eas env:set`, DEPLOY.md step 4). `.env` is never committed.

### The server functions: `functions/.env` (optional, copy from `functions/.env.example`)

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
npx --prefix firebase/tests firebase use --add      # pick your project, alias "default"
```

This writes `.firebaserc` with your project id (safe to commit).

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

It uses your `.env`, creates three temporary accounts
(`together-check-…@example.com`), pairs two of them through the real `acceptInvite`
in Singapore, tests the rules from outside, then deletes all three with the real
`deleteAccount`. Nothing of yours is touched. Expected output ends with
**"All checks passed. Your Firebase project is ready."**

## What each check proves

| # | Requirement | Emulators (`npm run verify`) | Live (`npm run verify:live`) |
|---|---|---|---|
| 1 | Firebase initialises | each test user connects with the app's config | your `.env` config connects |
| 2 | Registration and sign-in | sign-up, profile and settings exactly as the app writes them; sign-in again | the same, on your project |
| 3 | Invite and linking | `acceptInvite` pairs; codes can't be reused; a paired person can't invite or be invited; nobody can pair by writing directly | `acceptInvite` pairs; reuse refused |
| 4 | Database structure matches the app | every couple, membership and profile field checked against what the app reads | couple fields checked |
| 5 | Firestore rules | private logs and profiles hidden from the partner; mood refused while switched off; another couple can't read, list or write anything | partner can't read your profile; a stranger can't read the couple; mood refused while off |
| 6 | Storage rules | partner can open your photo, another couple can't; private files hidden even from the partner; nobody uploads into your folder | the same for photos |
| 7 | Functions in Singapore | calls answer in `asia-southeast1` and not in `us-central1` | the same |
| 8 | Account deletion | profile, private logs, settings, photo, private files, memberships, the couple and every shared note removed; sign-in gone; the partner is unlinked and can pair again; the other couple is untouched | partner unlinked, couple gone, sign-in gone |
| 9 | Settings documented | this file and `.env.example` | missing settings are named before anything runs |

Also covered by the emulator run: unlinking cuts access at once, data is kept 30
days, and a reconnect needs both people.
