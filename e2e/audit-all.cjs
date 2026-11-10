/**
 * Design audit: a screenshot of every screen, signed out, before pairing and
 * after, on a phone (tall, to show whole pages) and a few on a desktop.
 * Runs with the screenshot job (.github/workflows/firebase.yml). Images go to
 * e2e/screens/audit-*.png.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const OUT = path.join(__dirname, 'screens');
const run = Date.now().toString(36);
fs.mkdirSync(OUT, { recursive: true });
const tid = (id) => `[data-testid="${id}"]`;

const tallPhone = { viewport: { width: 390, height: 1700 }, deviceScaleFactor: 1 };
const desktop = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 };

const ROUTES = [
  ['/', 'today'],
  ['/their-day', 'their-day'],
  ['/notes', 'notes'],
  ['/together', 'together'],
  ['/trip', 'trip'],
  ['/log-steps', 'log-steps'],
  ['/log-mood', 'log-mood'],
  ['/check-in', 'check-in'],
  ['/vent', 'vent'],
  ['/calm', 'calm'],
  ['/stress-smash', 'stress-smash'],
  ['/cycle', 'cycle'],
  ['/mood-calendar', 'mood-calendar'],
  ['/gratitude', 'gratitude'],
  ['/todos', 'todos'],
  ['/weekend', 'weekend'],
  ['/weather', 'weather'],
  ['/bucket-list', 'bucket-list'],
  ['/date-night', 'date-night'],
  ['/milestones', 'milestones'],
  ['/memory-new', 'memory-new'],
  ['/trip-new', 'trip-new'],
  ['/schedule-note', 'schedule-note'],
  ['/reset', 'reset'],
  ['/privacy', 'privacy'],
  ['/settings', 'settings'],
  ['/appearance', 'appearance'],
  ['/question', 'question'],
  ['/find', 'find'],
  ['/notes-media', 'notes-media'],
  ['/steps-sync', 'steps-sync'],
  ['/storage', 'storage'],
  ['/vault', 'vault'],
];

async function shot(page, name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `audit-${name}.png`) });
}

async function signUp(page, name) {
  await page.goto(BASE);
  await page.locator(tid('name')).waitFor();
  await page.locator(tid('name')).fill(name);
  await page.locator(tid('email')).fill(`${name.toLowerCase()}-a-${run}@example.com`);
  await page.locator(tid('password')).fill('gentle-pass');
  await page.locator(tid('submit')).click();
}

async function main() {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async (who, opts) => {
    const ctx = await browser.newContext({ ...opts, colorScheme: 'light', timezoneId: 'Asia/Kuala_Lumpur', locale: 'en-MY' });
    await ctx.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: {} }));
    await ctx.route('https://api.data.gov.my/**', (r) => r.fulfill({ json: [] }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
    return page;
  };
  const a = await mk('afiq', tallPhone);
  const b = await mk('aina', tallPhone);

  // Signed out, and before pairing.
  await a.goto(BASE);
  await a.locator(tid('name')).waitFor();
  await shot(a, '00-sign-in');
  await signUp(a, 'Afiq');
  await a.locator(tid('create-invite')).waitFor();
  await shot(a, '01-pair');
  await a.locator(tid('create-invite')).click();
  const code = (await a.locator(tid('invite-code')).innerText()).trim();
  await shot(a, '02-invite-code');
  await signUp(b, 'Aina');
  await b.getByText('I have a code').click();
  await b.locator(tid('join-code')).fill(code);
  await b.locator(tid('find-invite')).click();
  await b.getByText('Afiq would like to connect').waitFor();
  await shot(b, '03-accept');
  await b.locator(tid('accept-invite')).click();
  await a.locator(tid('summary-line')).waitFor({ timeout: 15000 });

  // Empty states first (nothing logged yet).
  await shot(a, '04-today-empty');
  await a.goto(BASE + '/notes');
  await a.waitForTimeout(800);
  await shot(a, '05-notes-empty');

  // A little real data, so pages show content too.
  await a.goto(BASE + '/log-steps');
  await a.locator(tid('steps-input')).fill('6400');
  await a.locator(tid('save-steps')).click();
  await a.waitForTimeout(1500);
  await a.goto(BASE + '/');
  await a.locator(tid('summary-line')).waitFor();
  await b.goto(BASE + '/notes');
  await b.locator(tid('note-input')).fill('Miss you already. Lunch tomorrow? ♡');
  await b.locator(tid('send-note')).click();
  await b.waitForTimeout(800);

  for (const [route, name] of ROUTES) {
    try {
      await a.goto(BASE + route);
      await shot(a, `p-${name}`);
    } catch (e) {
      errors.push(`${route}: ${e.message}`);
    }
  }

  const d = await mk('afiq-desktop', desktop);
  await d.goto(BASE);
  await d.locator(tid('email')).waitFor();
  await d.getByText('I have an account').click();
  await d.locator(tid('email')).fill(`afiq-a-${run}@example.com`);
  await d.locator(tid('password')).fill('gentle-pass');
  await d.locator(tid('submit')).click();
  await d.locator(tid('summary-line')).waitFor({ timeout: 15000 });
  for (const [route, name] of [['/', 'today'], ['/notes', 'notes'], ['/together', 'together'], ['/settings', 'settings']]) {
    await d.goto(BASE + route);
    await shot(d, `d-${name}`);
  }

  await browser.close();
  console.log(errors.length ? `\nAudit page errors:\n${errors.join('\n')}` : '\nAudit: no page errors.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
