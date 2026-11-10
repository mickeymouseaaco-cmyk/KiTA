# Steps from iPhone (Apple Health)

A web app can't read Apple Health, so Together uses an iPhone **Shortcut**:

1. In the app: **Settings → Steps from iPhone → Make my link.** The server makes a
   private link (`startStepsSync`) and keeps only its hash in `stepTokens/{hash}`.
   The owner can see the link in `users/{uid}/settings/stepsSync`.
2. The Shortcut: *Find Health Samples* (Steps, today, grouped by day) →
   *Calculate Statistics* (Sum) → *Get Contents of URL*
   `https://asia-southeast1-kita-4a2e1.cloudfunctions.net/syncSteps?t=<secret>&steps=<Statistics>`.
3. A Shortcuts **automation** runs it every evening (and any time by hand).

`syncSteps` sets that day's steps in the private log and, if steps sharing is on,
in the shared day the partner sees. It accepts `8412`, `8,412`, `8.412`, `8412.0`;
anything over 150,000 or not a number is refused. Steps count for today in Malaysia
time, or yesterday if the Shortcut sends `&date=` for a late sync.

The link can only set its owner's step count. **Make a new link** or **Turn off**
retires the old one at once. Deleting the account removes it.

Tested in `firebase/tests/integration.test.ts` ("Steps from iPhone") and on the
live project by GitHub after each deploy.
