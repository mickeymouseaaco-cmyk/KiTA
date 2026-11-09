/**
 * End-to-end: two partners, two phones (browser contexts), real Firebase emulators.
 *
 *   npm run emulators                       # terminal 1
 *   EXPO_PUBLIC_USE_EMULATORS=1 npx expo export --platform web --output-dir dist
 *   node e2e/serve.cjs dist 8099            # terminal 2
 *   node e2e/two-partners.cjs               # terminal 3
 *
 * Screenshots land in e2e/screens/.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const OUT = path.join(__dirname, 'screens');
const PHOTO = path.join(__dirname, 'fixture-sunset.jpg');
const CLIP = path.join(__dirname, 'fixture-clip.webm');
const run = Date.now().toString(36);
fs.mkdirSync(OUT, { recursive: true });

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false };
const tid = (id) => `[data-testid="${id}"]`;

let step = 0;
function log(msg) {
  step += 1;
  console.log(`${String(step).padStart(2, '0')}. ${msg}`);
}

async function shot(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function signUp(page, name) {
  await page.goto(BASE);
  await page.locator(tid('name')).waitFor();
  await page.locator(tid('name')).fill(name);
  await page.locator(tid('email')).fill(`${name.toLowerCase()}-${run}@example.com`);
  await page.locator(tid('password')).fill('gentle-pass');
  await page.locator(tid('submit')).click();
}

const TAB_PATHS = { Today: '/', 'Their Day': '/their-day', 'Love Notes': '/notes', Together: '/together', Trip: '/trip' };

/** Switch tabs; if a stack screen is covering the tab bar, navigate directly instead. */
async function tab(page, label) {
  try {
    await page.getByRole('tab', { name: label }).first().click({ timeout: 3000 });
  } catch {
    try {
      await page.getByText(label, { exact: true }).last().click({ timeout: 3000 });
    } catch {
      await page.goto(BASE + TAB_PATHS[label]);
    }
  }
}

async function main() {
  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const consoleErrors = [];
  const mk = async (who, scheme = 'light') => {
    const ctx = await browser.newContext({ ...phone, colorScheme: scheme, permissions: ['microphone'] });
    // Deterministic place search and weather (Open-Meteo) for the trip steps.
    await ctx.route('https://geocoding-api.open-meteo.com/**', (route) => {
      const name = new URL(route.request().url()).searchParams.get('name') || '';
      const places = {
        lisbon: { name: 'Lisbon', country: 'Portugal', latitude: 38.72, longitude: -9.14 },
        kyoto: { name: 'Kyoto', country: 'Japan', latitude: 35.01, longitude: 135.77 },
      };
      const hit = places[name.toLowerCase()];
      route.fulfill({ json: { results: hit ? [hit] : [] } });
    });
    const sunny = { daily: { temperature_2m_max: [27, 29, 28, 30, 26, 27], temperature_2m_min: [17, 18, 18, 19, 16, 17], precipitation_sum: [0, 0, 4, 0, 0, 0], precipitation_probability_max: [5, 10, 60, 5, 0, 5] } };
    await ctx.route('https://archive-api.open-meteo.com/**', (route) => route.fulfill({ json: sunny }));
    await ctx.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: sunny }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => consoleErrors.push(`${who}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`${who} console: ${m.text().slice(0, 200)}`));
    return page;
  };
  const alex = await mk('alex');
  const blair = await mk('blair', 'dark');

  // ------------------------------------------------------------- pairing
  await alex.goto(BASE);
  await alex.locator(tid('name')).waitFor();
  await shot(alex, '01-sign-in');
  await signUp(alex, 'Alex');
  await alex.locator(tid('create-invite')).click();
  const code = (await alex.locator(tid('invite-code')).innerText()).trim();
  assert.match(code, /^[A-Z2-9]{6}$/);
  log(`Alex created invite ${code}`);
  await shot(alex, '02-invite-code');

  await signUp(blair, 'Blair');
  await blair.getByText('I have a code').click();
  await blair.locator(tid('join-code')).fill(code);
  await blair.locator(tid('find-invite')).click();
  await blair.getByText('Alex would like to connect').waitFor();
  await shot(blair, '03-accept-invite-dark');
  log('Blair sees the invite and what sharing means before accepting');

  // Not paired yet: Alex is still waiting.
  await alex.getByText('Waiting for your partner to accept').waitFor();
  await blair.locator(tid('accept-invite')).click();
  await blair.locator(tid('summary-line')).waitFor({ timeout: 15000 });
  await alex.locator(tid('summary-line')).waitFor({ timeout: 15000 });
  log('Both partners land on Today after Blair accepts');

  // ------------------------------------------------------------- steps + mood
  await alex.locator(tid('log-steps')).click();
  await alex.locator(tid('steps-input')).fill('9000');
  await alex.locator(tid('save-steps')).click();
  await alex.getByText('You walked 9,000 steps today. Be gentle with yourself.').waitFor();
  log('Alex logs 9,000 steps; kind summary line appears');
  await shot(alex, '04a-today-top-light');

  await alex.locator(tid('log-mood')).click();
  await alex.locator(tid('mood-Sad')).click();
  await alex.locator(tid('stress-5')).click();
  await alex.locator(tid('mood-note')).fill('Long day at work');
  await shot(alex, '05-log-mood');
  await alex.locator(tid('save-mood')).click();
  await alex.locator(tid('my-mood')).waitFor();
  await shot(alex, '04-today-light');
  log('Alex logs a heavy mood (private by default)');

  await tab(blair, 'Their Day');
  await blair.getByText('Steps').first().waitFor();
  await blair.waitForTimeout(1500);
  assert.equal(await blair.locator(tid('partner-mood')).count(), 0, 'mood must stay private by default');
  log('Blair sees Alex’s steps but NOT the private mood');

  // Alex turns mood sharing on in Privacy.
  await alex.getByRole('link', { name: /Just for you/ }).first().click();
  await alex.locator(tid('share-mood')).click();
  await alex.getByText('Mood and stress now shared').waitFor();
  await shot(alex, '06-privacy');
  await blair.locator(tid('partner-mood')).waitFor({ timeout: 10000 });
  await blair.locator(tid('gentle-alert')).waitFor();
  await shot(blair, '07-their-day-dark');
  log('After Alex shares mood, Blair sees it live, plus a gentle alert and ideas');

  // Alex turns it back off: it must disappear from Blair's view.
  await alex.locator(tid('share-mood')).click();
  await alex.getByText('Mood and stress is just for you now').waitFor();
  await blair.locator(tid('partner-mood')).waitFor({ state: 'detached', timeout: 10000 });
  log('Turning mood sharing off removes it from Blair’s view immediately');
  await alex.goBack();

  // ------------------------------------------------------------- hug + quick note
  await tab(alex, 'Today');
  await blair.locator(tid('hug-button')).click();
  await alex.locator(tid('hug-overlay')).waitFor({ timeout: 10000 });
  await shot(alex, '08-hug-received');
  log('Blair sends a hug; Alex’s app shows it live');
  await alex.locator(tid('hug-overlay')).click();

  await blair.locator(tid('quick-Proud of you')).click();
  await tab(alex, 'Love Notes');
  await alex.getByText('Proud of you').first().waitFor({ timeout: 10000 });
  log('Blair’s quick message arrives in Alex’s Love Notes');

  // ------------------------------------------------------------- love notes
  await alex.locator(tid('note-input')).fill('Thank you, love. Dinner’s on me tonight.');
  await alex.locator(tid('send-note')).click();

  const [chooser] = await Promise.all([alex.waitForEvent('filechooser'), alex.locator(tid('attach-photo')).click()]);
  await chooser.setFiles(PHOTO);
  await alex.locator(tid('photo-caption')).fill('Sunset from our walk');
  await alex.locator(tid('send-photo')).click();
  log('Alex sends a text note and a photo (resized, then uploaded via the outbox)');

  // Voice note with the fake microphone: tap once to lock, then Stop.
  await alex.locator(tid('attach-voice')).click();
  await alex.getByText('Record a voice note').first().waitFor();
  const mic = alex.locator(tid('record'));
  await mic.waitFor();
  await alex.waitForTimeout(800); // let the sheet finish sliding up before measuring
  const box = await mic.boundingBox();
  await alex.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await alex.mouse.down();
  await alex.waitForTimeout(2200);
  await shot(alex, '09-recording');
  await alex.mouse.up();
  log('Alex records a 2-second voice note by holding the mic');

  await tab(blair, 'Love Notes');
  await blair.getByText('Sunset from our walk').waitFor({ timeout: 20000 });
  await blair.getByText('Thank you, love.', { exact: false }).waitFor();
  await blair.locator('[aria-label="Play voice note"]').first().waitFor({ timeout: 20000 });
  await blair.waitForTimeout(1500);
  await shot(blair, '10-love-notes-dark');
  log('Blair receives text, photo and voice note live');

  // Blair hearts the photo note; it appears in Saved.
  const photoBubbleHeart = blair.locator('[aria-label="Save this note"]').nth(1);
  await photoBubbleHeart.click();
  await blair.getByText('Saved', { exact: true }).click();
  await blair.getByText('Sunset from our walk').waitFor();
  log('Blair hearts a note and finds it under Saved');
  await blair.getByText('All notes', { exact: true }).click();

  await alex.waitForTimeout(800);
  await shot(alex, '11-love-notes-light');

  // Alex takes back the photo note: gone for Blair, file and all.
  const photoNote = alex.getByText('Sunset from our walk');
  const takeBack = alex.locator('[aria-label="Take this note back"]');
  // Notes are newest-first in the inverted list; the photo is the 2nd newest of Alex's.
  const count = await takeBack.count();
  assert.ok(count >= 2);
  await takeBack.nth(1).click();
  await alex.locator(tid('confirm-take-back')).click();
  await photoNote.waitFor({ state: 'detached', timeout: 10000 });
  await blair.getByText('Sunset from our walk').waitFor({ state: 'detached', timeout: 10000 });
  log('Alex takes back the photo note; it disappears from Blair’s view too');

  // ------------------------------------------------------------- memory jar
  await tab(alex, 'Together');
  await alex.getByText('No memories here yet', { exact: false }).waitFor();
  await alex.locator(tid('new-memory')).click();
  const [chooser2] = await Promise.all([alex.waitForEvent('filechooser'), alex.locator(tid('memory-photo')).click()]);
  await chooser2.setFiles(PHOTO);
  await alex.locator(tid('memory-caption')).fill('Our first sunset walk');
  await shot(alex, '12-new-memory');
  await alex.locator(tid('save-memory')).click();
  await alex.getByText('Our first sunset walk').waitFor({ timeout: 20000 });
  await tab(blair, 'Together');
  await blair.getByText('Our first sunset walk').waitFor({ timeout: 20000 });
  await blair.waitForTimeout(1500);
  await shot(blair, '13-memory-jar-dark');
  log('Alex adds a photo memory; it appears in Blair’s Memory Jar');

  // ------------------------------------------------------------- vent
  await tab(alex, 'Today');
  await alex.locator(tid('open-vent')).click();
  await alex.locator(tid('vent-text')).fill('Everything at work today, ugh.');
  await shot(alex, '14-vent');
  await alex.locator(tid('vent-let-go')).click();
  await alex.locator(tid('vent-released')).waitFor();
  log('Alex vents privately and lets it go (nothing written to the server)');
  await alex.goBack();

  // ============================================================ Phase 2
  // ------------------------------------------------------------- food & water
  await tab(alex, 'Today');
  await alex.locator(tid('water-plus')).click();
  await alex.locator(tid('water-plus')).click();
  await alex.locator(tid('water-count')).filter({ hasText: '2' }).waitFor();
  await alex.locator(tid('add-meal')).click();
  await alex.locator(tid('meal-text')).fill('Soup and warm bread');
  await alex.locator(tid('save-meal')).click();
  await alex.getByText('Soup and warm bread').waitFor();
  await tab(blair, 'Their Day');
  await blair.getByText('Soup and warm bread').waitFor({ timeout: 10000 });
  log('Alex logs water and a meal; Blair sees it (food is shared by default, no calories anywhere)');

  // ------------------------------------------------------------- cycle
  await alex.getByText('Track your cycle (optional, private)').click();
  await alex.getByText('2 days ago').click();
  await alex.locator(tid('start-cycle')).click();
  await alex.locator(tid('cycle-phase')).filter({ hasText: 'Period · day 3' }).waitFor();
  await alex.locator(tid('symptom-Cramps')).click();
  await blair.waitForTimeout(1200);
  assert.equal(await blair.locator(tid('partner-cycle')).count(), 0, 'cycle must stay private by default');
  await alex.locator(tid('share-cycle-toggle')).click();
  await blair.locator(tid('partner-cycle')).waitFor({ timeout: 10000 });
  await blair.getByText('Bring a warm drink or a heat pad').waitFor();
  await shot(alex, '17-cycle-light');
  await shot(blair, '18-their-day-cycle-dark');
  log('Alex starts cycle tracking (private); after sharing, Blair sees the phase with gentle tips');
  await alex.goBack();

  // ------------------------------------------------------------- evening check-in
  await alex.locator(tid('open-checkin')).click();
  await alex.locator(tid('checkin-input')).fill('Blair made me laugh at dinner');
  await shot(alex, '19-check-in');
  await alex.locator(tid('save-checkin')).click();
  await alex.locator(tid('checkin-summary')).filter({ hasText: 'made me laugh' }).waitFor();
  log('Alex answers the evening check-in (kept private)');

  // ------------------------------------------------------------- calm corner
  await alex.locator(tid('open-calm')).click();
  await alex.locator(tid('breathe-toggle')).click();
  await alex.locator(tid('breath-label')).filter({ hasText: 'Breathe in' }).waitFor();
  await alex.waitForTimeout(4600);
  await alex.locator(tid('breath-label')).filter({ hasText: 'Hold softly' }).waitFor({ timeout: 4000 });
  await alex.locator(tid('sound-rain')).click();
  await alex.getByLabel('Pause Rain').waitFor({ timeout: 8000 });
  await shot(alex, '20-calm-corner');
  await alex.getByLabel('Pause Rain').click();
  log('Calm Corner: guided breathing moves through its phases; rain sound plays and pauses');
  await alex.goBack();

  // ------------------------------------------------------------- gratitude wall
  await tab(alex, 'Together');
  await alex.locator(tid('open-gratitude')).click();
  await alex.locator(tid('gratitude-input')).fill('Thank you for the tea this morning');
  await alex.locator(tid('send-gratitude')).click();
  await alex.getByText('Thank you for the tea this morning').waitFor();
  await tab(blair, 'Together');
  await blair.locator(tid('open-gratitude')).click();
  await blair.getByText('Thank you for the tea this morning').waitFor({ timeout: 10000 });
  await blair.locator(tid('gratitude-input')).fill('Thank you for walking with me');
  await blair.locator(tid('send-gratitude')).click();
  await blair.locator(tid('weekly-summary')).filter({ hasText: 'thanked each other 2 times' }).waitFor({ timeout: 10000 });
  await shot(blair, '21-gratitude-dark');
  log('Both send a thank-you; the weekly summary celebrates it');
  await blair.goBack();
  await alex.goBack();

  // ------------------------------------------------------------- mood calendar
  await alex.locator(tid('open-mood-calendar')).click();
  await alex.waitForTimeout(1200);
  await shot(alex, '22-mood-calendar');
  log('Mood calendar shows the month side by side');
  await alex.goBack();

  // ------------------------------------------------------------- view-once photo
  await tab(alex, 'Love Notes');
  const [chooser3] = await Promise.all([alex.waitForEvent('filechooser'), alex.locator(tid('attach-photo')).click()]);
  await chooser3.setFiles(PHOTO);
  await alex.locator(tid('opt-view-once')).click();
  await shot(alex, '23-view-once-options');
  await alex.locator(tid('send-photo')).click();
  await alex.locator(tid('view-once-status')).filter({ hasText: 'not opened yet' }).waitFor({ timeout: 20000 });
  await tab(blair, 'Love Notes');
  await blair.locator(tid('view-once-open')).waitFor({ timeout: 20000 });
  await blair.locator(tid('view-once-open')).click();
  await blair.locator(tid('view-once-close')).waitFor();
  await blair.waitForTimeout(1200);
  await shot(blair, '24-view-once-open');
  await blair.locator(tid('view-once-close')).click();
  await blair.locator(tid('view-once-status')).filter({ hasText: 'gone now' }).waitFor({ timeout: 10000 });
  await alex.locator(tid('view-once-status')).filter({ hasText: 'opened' }).waitFor({ timeout: 10000 });
  log('View-once photo: Blair opens it once, closing deletes it; Alex sees "opened"');

  // ------------------------------------------------------------- disappearing video
  await alex.locator(tid('attach-video')).click();
  const [chooser4] = await Promise.all([alex.waitForEvent('filechooser'), alex.locator(tid('choose-video')).click()]);
  await chooser4.setFiles(CLIP);
  await alex.locator(tid('photo-caption')).fill('Hello from the park');
  await alex.locator(tid('opt-disappearing')).click();
  await alex.locator(tid('send-photo')).click();
  await blair.getByText('Hello from the park').waitFor({ timeout: 30000 });
  await blair.getByText(/fades in 2[34]h/).first().waitFor();
  await blair.getByLabel(/Play video/).first().waitFor();
  await blair.waitForTimeout(800);
  await shot(blair, '25-video-disappearing-dark');
  log('Alex sends a 4-second disappearing video; Blair sees it with "fades in 24h"');

  // ============================================================ Phase 2 (finish) + Phase 3
  // ------------------------------------------------------------- love languages
  await tab(blair, 'Today');
  await blair.getByLabel('Settings').first().click();
  await blair.locator(tid('ll-service')).click();
  await blair.locator(tid('ll-service')).filter({ hasText: '1.' }).waitFor();
  await blair.goBack();
  await tab(alex, 'Their Day');
  await alex.getByText('Take a task off their list').first().waitFor({ timeout: 10000 });
  log('Blair picks a love language; Alex’s support ideas lead with it');

  // ------------------------------------------------------------- argument reset
  await alex.locator(tid('open-reset')).click();
  await alex.locator(tid('start-reset')).click();
  await alex.locator(tid('reset-paused')).click();
  await alex.locator(tid('reset-water')).click();
  await alex.locator(tid('reset-input')).fill('How patient you were with me today');
  await alex.locator(tid('reset-share')).click();
  await alex.getByText(/appreciation will appear here/).waitFor();
  await tab(blair, 'Their Day');
  await blair.locator(tid('open-reset-banner')).click();
  assert.equal(await blair.locator(tid('reset-theirs')).count(), 0, 'partner note stays hidden until you share yours');
  await blair.locator(tid('reset-input')).fill('That you always make me laugh');
  await blair.locator(tid('reset-share')).click();
  await blair.locator(tid('reset-theirs')).filter({ hasText: 'How patient you were' }).waitFor({ timeout: 10000 });
  await alex.locator(tid('reset-theirs')).filter({ hasText: 'make me laugh' }).waitFor({ timeout: 10000 });
  await shot(blair, '26-reset-dark');
  log('Argument Reset: each appreciation unlocks only after you share yours');
  await alex.goBack();
  await blair.goBack();

  // ------------------------------------------------------------- mood selfie (private)
  await tab(alex, 'Today');
  await alex.getByLabel('Update mood').click();
  const [selfie] = await Promise.all([alex.waitForEvent('filechooser'), alex.locator(tid('mood-selfie')).click()]);
  await selfie.setFiles(PHOTO);
  await alex.getByRole('img', { name: 'Your selfie' }).waitFor();
  await alex.locator(tid('save-mood')).click();
  await alex.getByRole('img', { name: 'Your mood selfie' }).waitFor({ timeout: 20000 });
  log('Alex adds a private selfie to their mood (stays in private storage)');

  // ------------------------------------------------------------- storage & vault
  await alex.getByLabel('Settings').first().click();
  await alex.locator(tid('open-storage')).click();
  await alex.locator(tid('shared-total')).waitFor({ timeout: 10000 });
  assert.notEqual((await alex.locator(tid('shared-total')).innerText()).trim(), '0 B');
  await alex.locator(tid('free-space')).click();
  await shot(alex, '27-storage');
  await alex.goBack();
  await alex.locator(tid('open-vault')).click();
  const [vaultPick] = await Promise.all([alex.waitForEvent('filechooser'), alex.locator(tid('vault-photo')).click()]);
  await vaultPick.setFiles(PHOTO);
  await alex.locator(tid('vault-remove')).first().waitFor({ timeout: 20000 });
  log('Storage shows usage and frees space; a photo goes into the private vault');
  await alex.goBack();
  await alex.goBack();

  // ------------------------------------------------------------- trip planning
  await tab(alex, 'Trip');
  await alex.locator(tid('new-trip')).click();
  await alex.locator(tid('trip-title')).fill('Lisbon getaway');
  await alex.locator(tid('trip-destination')).fill('Lisbon');
  await alex.locator(tid('trip-find')).click();
  await alex.locator(tid('trip-place')).filter({ hasText: 'Portugal' }).waitFor();
  await alex.locator(tid('save-trip')).click();
  await alex.locator(tid('trip-countdown')).filter({ hasText: '30 days to go' }).waitFor({ timeout: 10000 });
  await alex.locator(tid('trip-weather-fetch')).click();
  await alex.locator(tid('trip-weather')).waitFor({ timeout: 10000 });
  await alex.getByText('Sunscreen').waitFor({ timeout: 10000 });
  await alex.locator(tid('trip-stress-4')).click();
  await alex.locator(tid('trip-stress-reply')).waitFor();
  log('Alex plans a trip: place lookup, countdown, weather-aware packing, stress check');

  await tab(blair, 'Trip');
  await blair.locator(tid('next-trip')).click();
  await blair.locator(tid('item-Passports / ID')).click();
  await alex.getByText(`${'Blair'} got this`).waitFor({ timeout: 10000 });
  await shot(alex, '28-trip-plan');
  log('Blair ticks "Passports" on the shared checklist; Alex sees it live');

  await alex.getByText('Journal', { exact: true }).click();
  await alex.locator(tid('entry-caption')).fill('Custard tarts by the river');
  const [tripPhoto] = await Promise.all([alex.waitForEvent('filechooser'), alex.locator(tid('entry-photo')).click()]);
  await tripPhoto.setFiles(PHOTO);
  await alex.getByText('Custard tarts by the river').waitFor({ timeout: 20000 });
  await alex.locator(tid('open-slideshow')).click();
  await alex.locator(tid('slide-caption')).filter({ hasText: 'Custard tarts' }).waitFor({ timeout: 10000 });
  await alex.waitForTimeout(1200);
  await shot(alex, '29-slideshow');
  await alex.locator(tid('slideshow-close')).click();
  log('Travel journal photo entry, then the trip slideshow');
  await alex.goBack();
  await blair.goBack();

  // ------------------------------------------------------------- bucket list map
  await blair.locator(tid('open-bucket')).click();
  await blair.locator(tid('pin-input')).fill('Kyoto');
  await blair.locator(tid('pin-add')).click();
  await blair.locator(tid('pin-Kyoto')).waitFor({ timeout: 10000 });
  await blair.waitForTimeout(600);
  await shot(blair, '30-bucket-map-dark');
  log('Blair pins Kyoto on the shared bucket-list map');
  await blair.goBack();

  // ------------------------------------------------------------- date night & milestones
  await tab(alex, 'Together');
  await alex.locator(tid('open-date-night')).click();
  await alex.locator(tid('budget-0')).click();
  await alex.locator(tid('roll-idea')).click();
  await alex.locator(tid('idea-title')).waitFor();
  await shot(alex, '31-date-night');
  await alex.locator(tid('send-idea')).click();
  await tab(blair, 'Love Notes');
  await blair.getByText(/Date idea:/).first().waitFor({ timeout: 10000 });
  log('Date Night Generator picks a free idea; Alex sends it to Blair');
  await alex.goBack();

  const soon = new Date(Date.now() + 7 * 86_400_000);
  const msDate = `2021-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
  await alex.locator(tid('open-milestones')).click();
  await alex.locator(tid('ms-add')).click();
  await alex.locator(tid('ms-date')).fill(msDate);
  await alex.locator(tid('ms-save')).click();
  await alex.locator(tid('milestone-days')).filter({ hasText: 'In 7 days' }).waitFor({ timeout: 10000 });
  await alex.locator(tid('milestone-prompt')).filter({ hasText: 'Book a table' }).waitFor();
  await shot(alex, '32-milestones');
  log('Anniversary in a week: countdown, years together, and a sweet planning prompt');
  await alex.goBack();

  // ------------------------------------------------------------- scheduled + surprise notes
  await alex.locator(tid('open-surprise')).click();
  await alex.locator(tid('sched-text')).fill('Good luck at your big meeting tomorrow!');
  await alex.locator(tid('sched-send')).click();
  await alex.locator(tid('open-surprise')).click();
  await alex.getByText('Next open', { exact: true }).click();
  await alex.locator(tid('sched-text')).fill('I hid this here just to say: I adore you.');
  await alex.locator(tid('sched-send')).click();
  await tab(alex, 'Love Notes');
  await alex.locator(tid('waiting-toggle')).filter({ hasText: '1 note is waiting' }).waitFor({ timeout: 10000 });
  log('Alex schedules a note for tomorrow and hides a "next open" surprise');

  await blair.reload();
  await blair.locator(tid('surprise-waiting')).waitFor({ timeout: 45000 });
  await shot(blair, '33-surprise-waiting-dark');
  await blair.locator(tid('surprise-go')).click();
  await blair.locator(tid('unwrap-surprise')).click();
  await blair.locator(tid('confetti')).waitFor({ timeout: 5000 });
  await blair.locator(tid('scheduled-text')).filter({ hasText: 'I adore you' }).waitFor({ timeout: 10000 });
  assert.equal(await blair.getByText('Good luck at your big meeting').count(), 0, 'tomorrow’s note must stay hidden');
  await blair.waitForTimeout(400);
  await shot(blair, '34-surprise-unwrapped-dark');
  log('Blair opens the app: the surprise is waiting, unwraps with confetti; tomorrow’s note stays hidden');

  // ------------------------------------------------------------- plant & streak
  await tab(alex, 'Together');
  await alex.locator(tid('plant-stage')).waitFor();
  const stage = (await alex.locator(tid('plant-stage')).innerText()).trim();
  assert.notEqual(stage, 'Seed', 'all that care should have grown the plant');
  await alex.waitForTimeout(800);
  await shot(alex, '35-together-plant');
  log(`The shared plant grew from all that care (now: ${stage})`);

  // Their day, light theme, from Blair's side of things for Alex
  await tab(alex, 'Their Day');
  await alex.waitForTimeout(1200);
  await shot(alex, '15-their-day-light');
  await tab(alex, 'Trip');
  await shot(alex, '16-trip-light');

  if (consoleErrors.length) {
    console.log('\nConsole errors seen:');
    for (const e of [...new Set(consoleErrors)].slice(0, 20)) console.log('  -', e);
  }
  await browser.close();
  console.log(`\nAll ${step} steps passed. Screenshots: ${OUT}`);
}

main().catch(async (e) => {
  console.error('\nE2E FAILED at step', step + 1, '\n', e);
  process.exit(1);
});
