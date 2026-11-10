/**
 * Screenshots of the app polish, on a phone-sized browser against the Firebase
 * emulators: one-line greeting, the love-note box, weather at a glance, steps
 * from iPhone, and every style in Look & feel. Runs in GitHub on pull requests
 * (.github/workflows/firebase.yml, "Screenshots"); images land in e2e/screens/.
 *
 *   npm run emulators
 *   EXPO_PUBLIC_USE_EMULATORS=1 npx expo export --platform web --output-dir dist
 *   node e2e/serve.cjs dist 8099
 *   node e2e/look-and-feel.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const OUT = path.join(__dirname, 'screens');
const run = Date.now().toString(36);
fs.mkdirSync(OUT, { recursive: true });

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
const small = { viewport: { width: 360, height: 760 }, deviceScaleFactor: 2 };
const tid = (id) => `[data-testid="${id}"]`;

let step = 0;
/** Every open page and every page error, so any failure leaves evidence. */
const pages = {};
const errors = [];
const log = (msg) => console.log(`${String(++step).padStart(2, '0')}. ${msg}`);

async function shot(page, name, full = false) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
}

/** A rainy week with official warnings, so the weather screen has something to show. */
function mockWeather(ctx) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + i * 86_400_000 + 8 * 3600_000);
    return d.toISOString().slice(0, 10);
  });
  const forecast = {
    daily: {
      time: days,
      temperature_2m_max: [31, 30, 29, 32, 33, 31, 30],
      temperature_2m_min: [24, 24, 23, 25, 25, 24, 24],
      precipitation_sum: [48, 22, 6, 0, 1, 12, 35],
      precipitation_probability_max: [90, 80, 40, 10, 15, 60, 85],
      weather_code: [95, 63, 80, 1, 2, 61, 65],
    },
    hourly: { time: days.map((d) => `${d}T16:00`), precipitation: [22, 9, 3, 0, 0, 6, 16] },
  };
  const until = new Date(Date.now() + 6 * 3600_000 + 8 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
  const warnings = [
    {
      warning_issue: { issued: until, title_en: 'Thunderstorms Warning' },
      valid_from: null,
      valid_to: until,
      heading_en: 'Thunderstorms, heavy rain and strong winds',
      text_en: 'Thunderstorms, heavy rain and strong winds are expected over Selangor (Petaling, Klang, Kuala Langat) until 6:00 pm.',
      instruction_en: 'Avoid open areas.',
    },
    {
      warning_issue: { issued: until, title_en: 'Continuous Rain Warning (Alert Level)' },
      valid_from: null,
      valid_to: until,
      heading_en: 'Continuous rain',
      text_en: 'Continuous rain is expected in Selangor until tomorrow.',
      instruction_en: '',
    },
  ];
  ctx.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: forecast }));
  ctx.route('https://api.data.gov.my/weather/warning**', (r) => r.fulfill({ json: warnings }));
  ctx.route('https://api.data.gov.my/flood-warning**', (r) =>
    r.fulfill({
      json: [
        { station_name: 'Sg. Klang di Jambatan Kota', state: 'Selangor', district: 'Klang', water_level_current: 2.1, water_level_alert_level: 2.4, water_level_warning_level: 2.8, water_level_danger_level: 3.2, water_level_update_datetime: until },
        { station_name: 'Sg. Damansara di TTDI Jaya', state: 'Selangor', district: 'Petaling', water_level_current: 3.0, water_level_alert_level: 2.9, water_level_warning_level: 3.4, water_level_danger_level: 3.9, water_level_update_datetime: until },
      ],
    }),
  );
}

async function signUp(page, name) {
  await page.goto(BASE);
  await page.locator(tid('name')).waitFor();
  await page.locator(tid('name')).fill(name);
  await page.locator(tid('email')).fill(`${name.toLowerCase().replace(/\W/g, '')}-${run}@example.com`);
  await page.locator(tid('password')).fill('gentle-pass');
  await page.locator(tid('submit')).click();
}

async function main() {
  const browser = await chromium.launch();
  const mk = async (who, opts = phone, scheme = 'light', geo = { latitude: 3.0657, longitude: 101.4846 }) => {
    const ctx = await browser.newContext({ ...opts, colorScheme: scheme, timezoneId: 'Asia/Kuala_Lumpur', locale: 'en-MY', permissions: ['geolocation'], geolocation: { ...geo, accuracy: 25 } });
    mockWeather(ctx);
    ctx.route('https://nominatim.openstreetmap.org/**', (r) => {
      const lat = Number(new URL(r.request().url()).searchParams.get('lat'));
      r.fulfill({ json: lat > 3.055 ? { name: 'i-City', address: { suburb: 'Seksyen 7', city: 'Shah Alam' } } : { address: { road: 'Jalan Meru', city: 'Klang' } } });
    });
    ctx.route('https://www.openstreetmap.org/**', (r) => r.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#dfe8d8;font:14px sans-serif;display:grid;place-items:center;height:100vh">map</body>' }));
    const page = await ctx.newPage();
    pages[who] = page;
    page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${who} console: ${m.text().slice(0, 300)}`));
    return page;
  };
  const afiq = await mk('afiq', small);
  const aina = await mk('aina', phone, 'light', { latitude: 3.0449, longitude: 101.4456 });

  await signUp(afiq, 'Afiq Hakimi');
  await afiq.locator(tid('create-invite')).click();
  const code = (await afiq.locator(tid('invite-code')).innerText()).trim();
  await signUp(aina, 'Aina');
  await aina.getByText('I have a code').click();
  await aina.locator(tid('join-code')).fill(code);
  await aina.locator(tid('find-invite')).click();
  await aina.locator(tid('accept-invite')).click();
  await afiq.locator(tid('summary-line')).waitFor({ timeout: 15000 });
  log('Afiq and Aina paired');

  // 1. Greeting on one line, even with a long name on a small phone.
  await shot(afiq, '01-today-greeting-360px');
  const greeting = afiq.getByRole('heading').first();
  const box = await greeting.boundingBox();
  assert.ok(box && box.height < 50, `greeting should be one line (height ${box && box.height})`);
  log(`Greeting is one line (${Math.round(box.height)}px tall)`);

  // 2. Love-note box: wide, grows with the text, attachments behind +.
  await afiq.goto(BASE + '/notes');
  await afiq.locator(tid('note-input')).waitFor();
  const input = afiq.locator(tid('note-input'));
  const w = (await input.boundingBox()).width;
  assert.ok(w > 200, `note box should be wide (got ${Math.round(w)}px on a 360px phone)`);
  await shot(afiq, '02-notes-empty');
  await input.fill('Good morning sayang ♡\nDon’t forget your umbrella today, it’s going to pour after lunch.\nSee you tonight!');
  await afiq.waitForTimeout(300);
  const grown = (await input.boundingBox()).height;
  assert.ok(grown > 60, `note box should grow with the text (height ${Math.round(grown)})`);
  await shot(afiq, '03-notes-typing');
  await afiq.locator(tid('attach-toggle')).click();
  await afiq.locator(tid('attach-photo')).waitFor();
  await shot(afiq, '04-notes-attachments');
  await afiq.locator(tid('attach-toggle')).click();
  await afiq.locator(tid('send-note')).click();
  await aina.goto(BASE + '/notes');
  await aina.getByText('Don’t forget your umbrella').first().waitFor({ timeout: 10000 });
  // Long-press a note for its options (no more buttons under every note).
  assert.equal(await afiq.locator('[data-testid^="heart-"], [data-testid^="star-"], [data-testid^="take-back-"]').count(), 0, 'no buttons under notes');
  await afiq.getByText('Don’t forget your umbrella').first().hover();
  await afiq.mouse.down();
  await afiq.waitForTimeout(800);
  await afiq.mouse.up();
  await afiq.locator(tid('opt-star')).waitFor({ timeout: 5000 });
  await shot(afiq, '04b-notes-long-press');
  await afiq.locator(tid('opt-star')).click();
  await afiq.locator(tid('pinned-notes')).waitFor({ timeout: 10000 });
  log('Long-press opens note options; starring pins it for both');
  log(`Love-note box is ${Math.round(w)}px wide, grows to ${Math.round(grown)}px, and sends`);

  // 3. Weather at a glance.
  await afiq.goto(BASE + '/weather');
  await afiq.locator(tid('flood-today')).waitFor({ timeout: 15000 });
  await afiq.getByText('Thunderstorms').first().waitFor();
  await shot(afiq, '05-weather-top');
  await afiq.getByRole('button', { name: /Thunderstorms/ }).first().click();
  await shot(afiq, '06-weather-warning-open', true);
  log('Weather shows icons and short warnings; full MET text on tap');

  // 4. Steps from iPhone.
  await afiq.goto(BASE + '/steps-sync');
  await afiq.locator(tid('start-steps-sync')).click();
  await afiq.locator(tid('steps-link')).waitFor({ timeout: 15000 });
  const link = (await afiq.locator(tid('steps-link')).innerText()).trim();
  const res = await fetch(`${link}&steps=${encodeURIComponent('8,412')}`);
  assert.equal(res.status, 200, await res.text());
  await afiq.getByText(/Last sync .* 8,412 steps/).waitFor({ timeout: 10000 });
  await shot(afiq, '07-steps-sync', true);
  await aina.goto(BASE + '/their-day');
  try {
    await aina.getByText(/8,412/).first().waitFor({ timeout: 10000 });
  } catch (e) {
    await shot(aina, 'dbg-aina-their-day');
    console.log('DEBUG url', aina.url());
    console.log('DEBUG text', (await aina.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600));
    console.log('DEBUG page errors', errors.join(' | ') || 'none');
    throw e;
  }
  await shot(aina, '07-their-day-steps');
  log('A Shortcut call with “8,412” lands in Afiq’s day and Aina sees it');

  // 4b. Question of the day: Afiq answers, Aina is told, answers, and both appear.
  await afiq.goto(BASE + '/question');
  await afiq.locator(tid('question-text')).waitFor({ timeout: 15000 });
  await afiq.locator(tid('answer-input')).fill('Your laugh at dinner last night');
  await afiq.locator(tid('answer-send')).click();
  await afiq.locator(tid('answer-waiting')).waitFor({ timeout: 10000 });
  await shot(afiq, '07a-question-waiting');
  await aina.goto(BASE + '/');
  await aina.locator(tid('question-status')).filter({ hasText: 'Your turn' }).waitFor({ timeout: 20000 });
  await shot(aina, '07b-home-question-your-turn');
  await aina.goto(BASE + '/question');
  assert.equal(await aina.getByText('Your laugh at dinner last night').count(), 0, 'no peeking before answering');
  await aina.locator(tid('answer-input')).fill('Our slow breakfast on Saturday');
  await aina.locator(tid('answer-send')).click();
  await aina.getByText('Your laugh at dinner last night').waitFor({ timeout: 10000 });
  await shot(aina, '07c-question-both');
  await afiq.getByText('Our slow breakfast on Saturday').waitFor({ timeout: 10000 });
  log('Question of the day: hidden until both answer, then both see both answers');

  // 4b2. Find my partner: both choose to share, then see each other.
  await afiq.goto(BASE + '/find');
  await afiq.locator(tid('partner-not-sharing')).waitFor({ timeout: 15000 });
  await afiq.locator(tid('share-location')).click();
  await aina.goto(BASE + '/find');
  await aina.getByText('i-City, Seksyen 7, Shah Alam').waitFor({ timeout: 15000 });
  await aina.locator(tid('share-location')).click();
  await afiq.getByText('Jalan Meru, Klang').waitFor({ timeout: 15000 });
  await afiq.getByText(/km apart/).first().waitFor({ timeout: 15000 });
  await shot(afiq, '07d-find', true);
  await aina.locator(tid('share-location')).click(); // Aina stops: her location disappears for Afiq
  await afiq.locator(tid('partner-not-sharing')).waitFor({ timeout: 15000 });
  log('Find my partner: both opt in and see each other; stopping removes it at once');

  // 4b3. Stress Smash: type a name, LET IT OUT, replay, bonus bonk, someone else, back.
  //      The name must never leave the page: no request carries it, nothing stores it.
  const leaks = [];
  const watchLeak = (r) => {
    const body = r.postData() ?? '';
    if (r.url().includes('Boss Ahmad') || r.url().includes('Boss%20Ahmad') || body.includes('Boss Ahmad')) leaks.push(r.url());
  };
  afiq.on('request', watchLeak);
  await afiq.goto(BASE + '/together');
  await afiq.locator(tid('open-stress-smash')).click();
  await afiq.locator(tid('smash-name')).waitFor({ timeout: 15000 });
  assert.equal((await afiq.locator(tid('smash-target')).innerText()).trim(), 'Mr. Stress');
  await afiq.locator(tid('smash-name')).fill('Boss Ahmad');
  assert.equal((await afiq.locator(tid('smash-target')).innerText()).trim(), 'Boss Ahmad');
  await shot(afiq, '07e-smash-ready');
  await afiq.locator(tid('smash-go')).click();
  await afiq.waitForTimeout(560);
  await afiq.screenshot({ path: path.join(OUT, '07f-smash-bonk.png') });
  await afiq.waitForTimeout(1500);
  await afiq.screenshot({ path: path.join(OUT, '07g-smash-bonk-later.png') });
  await afiq.locator(tid('smash-cheer')).waitFor({ timeout: 15000 });
  assert.equal((await afiq.locator(tid('smash-cheer')).innerText()).trim(), 'There you go! Feeling better? 😂');
  await shot(afiq, '07h-smash-done');
  await afiq.locator(tid('smash-replay')).click();
  await afiq.getByText('Stress level: hopefully reduced!').waitFor({ timeout: 15000 });
  await afiq.locator(tid('smash-dummy')).click(); // bonus bonk
  await afiq.waitForTimeout(800);
  await afiq.locator(tid('smash-mute')).click();
  assert.equal(await afiq.locator(tid('smash-mute')).getAttribute('aria-label'), 'Sound off. Tap to turn on');
  // Desktop size.
  await afiq.setViewportSize({ width: 1280, height: 800 });
  await afiq.locator(tid('smash-replay')).click();
  await afiq.waitForTimeout(560);
  await afiq.screenshot({ path: path.join(OUT, '07i-smash-desktop-bonk.png') });
  await afiq.getByText('Deep breath. You’ve got this! ❤️').waitFor({ timeout: 15000 });
  await shot(afiq, '07j-smash-desktop-done');
  await afiq.setViewportSize(small.viewport);
  // Someone else clears the name.
  await afiq.locator(tid('smash-someone-else')).click();
  assert.equal(await afiq.locator(tid('smash-name')).inputValue(), '');
  assert.equal((await afiq.locator(tid('smash-target')).innerText()).trim(), 'Mr. Stress');
  // Reduce motion: a still version that still finishes.
  await afiq.emulateMedia({ reducedMotion: 'reduce' });
  await afiq.goto(BASE + '/stress-smash');
  await afiq.locator(tid('smash-name')).fill('Boss Ahmad');
  await afiq.locator(tid('smash-go')).click();
  await afiq.waitForTimeout(400);
  await afiq.screenshot({ path: path.join(OUT, '07k-smash-reduced-motion.png') });
  await afiq.locator(tid('smash-cheer')).waitFor({ timeout: 15000 });
  await afiq.emulateMedia({ reducedMotion: 'no-preference' });
  // Back goes to Together even when the page was opened directly.
  await afiq.locator(tid('smash-back')).click();
  await afiq.locator(tid('open-stress-smash')).waitFor({ timeout: 15000 });
  const stored = await afiq.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  assert.ok(!stored.includes('Boss Ahmad'), 'the name is not stored');
  afiq.off('request', watchLeak);
  assert.deepEqual(leaks, [], 'the name is never sent anywhere');
  log('Stress Smash: bonks, replays, bonus bonk, mute, desktop, reduced motion; the name never leaves the page');

  // 4c. Installable: manifest, icons and the service worker are served.
  const manifest = await (await fetch(BASE + '/manifest.json')).json();
  assert.equal(manifest.name, 'KiTA');
  assert.equal((await fetch(BASE + '/icons/icon-512.png')).status, 200);
  assert.match(await (await fetch(BASE + '/sw.js')).text(), /showNotification/);
  const swReady = await afiq.evaluate(() => navigator.serviceWorker.ready.then((r) => !!r.active).catch(() => false));
  assert.ok(swReady, 'service worker is running');
  log('Installable: manifest, icons and service worker are in place');

  // 5. Look & feel: every style, a few colours, light and dark.
  await afiq.goto(BASE + '/appearance');
  await afiq.locator(tid('look-soft')).waitFor();
  await shot(afiq, '08-appearance', true);
  const combos = [
    ['professional', 'ocean'],
    ['playful', 'blossom'],
    ['soft', 'forest'],
    ['playful', 'sunset'],
  ];
  for (const [look, color] of combos) {
    await afiq.goto(BASE + '/appearance');
    await afiq.locator(tid(`look-${look}`)).click();
    await afiq.locator(tid(`color-${color}`)).click();
    await afiq.goto(BASE + '/');
    await afiq.locator(tid('summary-line')).waitFor();
    await shot(afiq, `09-today-${look}-${color}`);
    await afiq.goto(BASE + '/notes');
    await afiq.locator(tid('note-input')).waitFor();
    await shot(afiq, `10-notes-${look}-${color}`);
  }
  await afiq.emulateMedia({ colorScheme: 'dark' });
  await afiq.goto(BASE + '/');
  await afiq.locator(tid('summary-line')).waitFor();
  await shot(afiq, '11-today-playful-sunset-dark');
  await afiq.goto(BASE + '/weather');
  await afiq.locator(tid('flood-today')).waitFor({ timeout: 15000 });
  await shot(afiq, '12-weather-dark');

  // The choice follows Afiq to another phone.
  const afiq2 = await mk('afiq-2nd-phone');
  await afiq2.goto(BASE);
  await afiq2.locator(tid('email')).waitFor();
  await afiq2.getByText('I have an account').click();
  await afiq2.locator(tid('email')).fill(`afiqhakimi-${run}@example.com`);
  await afiq2.locator(tid('password')).fill('gentle-pass');
  await afiq2.locator(tid('submit')).click();
  await afiq2.locator(tid('summary-line')).waitFor({ timeout: 15000 });
  await afiq2.waitForTimeout(1500);
  await shot(afiq2, '13-second-phone-same-look');
  log('Each style and colour rendered; choice follows to a second phone');

  await browser.close();
  const crashes = errors.filter((e) => !e.includes(' console: ')); // console messages are evidence, not failures
  if (crashes.length) {
    console.log('\nPage errors:\n' + crashes.join('\n'));
    process.exit(1);
  }
  console.log('\nAll look-and-feel checks passed.');
}

main().catch(async (e) => {
  console.error(e);
  for (const [who, page] of Object.entries(pages)) {
    try {
      await page.screenshot({ path: path.join(OUT, `fail-${who}.png`) });
      console.log(`FAIL ${who} at ${page.url()}: ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300)}`);
    } catch {}
  }
  console.log('FAIL page errors:\n' + (errors.join('\n') || 'none'));
  process.exit(1);
});
