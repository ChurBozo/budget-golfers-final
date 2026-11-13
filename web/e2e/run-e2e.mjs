// End-to-end test: a real browser against the real website, API and database.
// It signs in, uploads rounds the way the phone app does, uses every view,
// and saves screenshots as test evidence (docs/test-results/screenshots).
//
// Needs: the API on :3000 with the seed data loaded (npm run seed && npm start
// in ../api), the website on :5000 (npm run dev), and Playwright:
//   npm i -D playwright && npx playwright install chromium
//   npm run test:e2e
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}
const { chromium, devices } = playwright;

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5000';
const API = process.env.API_URL || 'http://localhost:3000';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'docs', 'test-results');
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let failed = 0;
async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    results.push({ name, ok: false, ms: Date.now() - started, error: err.message.split('\n')[0] });
    console.log(`  ✗ ${name}\n      ${err.message.split('\n')[0]}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

// A round in the exact shape the phone app uploads (Round.toApiJson()).
function appRound({ daysAgo, strokesPerHole, holes = 18, clientRoundId }) {
  const playedAt = new Date(Date.now() - daysAgo * 864e5).toISOString();
  const list = Array.from({ length: holes }, (_, i) => ({
    number: i + 1,
    par: i % 4 === 1 ? 3 : 4,
    distanceMetres: i % 4 === 1 ? 150 : 340,
    strokes: strokesPerHole + (i === 0 ? -1 : 0),
    putts: 2,
    penalties: 0,
    teeClub: i % 4 === 1 ? '7i' : 'driver',
    ...(i % 4 === 1 ? {} : { fairwayHit: i % 2 === 0 }),
    shots: [
      { seq: 1, club: i % 4 === 1 ? '7i' : 'driver', start: { lat: -37.6741, lng: 176.224 }, end: { lat: -37.6741 + (i % 4 === 1 ? 140 : 215) / 111195, lng: 176.224 }, result: i % 3 ? 'fairway' : 'rough-left' },
    ],
  }));
  return { clientRoundId, course: { name: 'Pāpāmoa Muni 9 E2E' }, tee: 'Yellow', playedAt, source: 'mobile-app', holes: list };
}

async function login(page, email, password = 'Correct-Horse-7') {
  await page.goto(`${WEB}/login`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('form button[type=submit]');
}

async function main() {
  const browser = await chromium.launch();
  const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
  const email = `e2e.${Date.now()}@example.com`;
  const consoleErrors = [];

  console.log(`Budget Golfers end-to-end test\n  website ${WEB}\n  API     ${API}\n`);

  // ---------- 1. Sign-in, register and guarding ----------
  const ctx = await browser.newContext(desktop);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  await check('A private page without a session redirects to /login', async () => {
    await page.goto(`${WEB}/rounds`);
    await page.waitForURL('**/login');
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    await shot(page, '01-login');
  });

  await check('Wrong password shows the API 401 message under the field', async () => {
    await login(page, 'aroha.m@example.com', 'wrong-password');
    await page.getByText('Email or password is incorrect.').waitFor();
    await shot(page, '02-login-error');
  });

  await check('Register checks the fields in the browser first', async () => {
    await page.goto(`${WEB}/register`);
    await page.fill('#email', 'not-an-email');
    await page.fill('#password', 'short');
    await page.click('form button[type=submit]');
    await page.getByText('Enter a valid email address.').waitFor();
    await page.getByText('Use at least 8 characters.').waitFor();
    await page.getByText('Use 2 to 30 characters.').waitFor();
    await shot(page, '03-register-validation');
  });

  await check('Registering a new golfer signs them in to an empty dashboard', async () => {
    await page.fill('#displayName', 'E2E Golfer');
    await page.fill('#email', email);
    await page.fill('#password', 'Correct-Horse-7');
    await page.fill('#homeCourseName', 'Pāpāmoa Muni 9 E2E');
    await page.click('form button[type=submit]');
    await page.waitForURL('**/dashboard');
    await page.getByText('No rounds yet.').first().waitFor();
    await shot(page, '04-dashboard-empty');
  });

  // ---------- 2. Rounds arrive from the "app" ----------
  let token;
  await check('Rounds uploaded with the app format appear after a refresh', async () => {
    token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('bg.session')).token);
    const ids = [];
    for (const [i, r] of [[1, 5], [2, 6], [3, 5], [4, 4]].entries()) {
      const res = await fetch(`${API}/api/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(appRound({ daysAgo: r[0] * 3, strokesPerHole: r[1], clientRoundId: `e2e-${Date.now()}-${i}` })),
      });
      assert(res.status === 201, `upload ${i} returned ${res.status}`);
      ids.push((await res.json()).data.id);
    }
    const nine = await fetch(`${API}/api/rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(appRound({ daysAgo: 1, strokesPerHole: 5, holes: 9, clientRoundId: `e2e-${Date.now()}-nine` })),
    });
    assert(nine.status === 201, `9-hole upload returned ${nine.status}`);
    await page.reload();
    await page.locator('.stat-value').first().waitFor();
    const avg = await page.locator('.stat-value').first().innerText();
    assert(avg !== '–', 'average score is empty');
    await page.locator('.recharts-line').first().waitFor();
  });

  await check('Period chips change the URL and the numbers', async () => {
    await page.getByRole('link', { name: 'Last 5' }).click();
    await page.waitForURL('**/dashboard?period=last5');
    await page.getByText('Last 5 rounds').waitFor();
  });

  await check('Round history filters live in the URL', async () => {
    await page.getByRole('link', { name: 'Rounds' }).first().click();
    await page.waitForURL('**/rounds');
    await page.getByRole('heading', { name: 'Round history' }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.round-item').length > 0);
    assert((await page.locator('.round-item').count()) === 5, 'expected 5 rounds');
    await page.selectOption('#holes', '9');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForURL('**/rounds?holes=9');
    await page.waitForFunction(() => document.querySelectorAll('.round-item').length === 1);
    await page.goBack();
    await page.waitForFunction(() => document.querySelectorAll('.round-item').length === 5);
  });

  await check('Round detail shows the scorecard and the shot list', async () => {
    await page.locator('.round-item a').first().click();
    await page.waitForURL(/\/rounds\/[a-f0-9]{24}$/);
    await page.locator('.scorecard').first().waitFor();
    await page.locator('.shot-list summary').first().click();
    await page.getByText('Rough, left').first().waitFor();
  });

  await check('Deleting a round asks first, then returns to the list', async () => {
    await page.getByRole('button', { name: 'Delete round' }).click();
    await page.getByRole('dialog').waitFor();
    await shot(page, '05-delete-round-dialog');
    await page.getByRole('dialog').getByRole('button', { name: 'Delete round' }).click();
    await page.waitForURL('**/rounds');
    await page.getByText(/^Deleted /).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.round-item').length === 4);
  });

  await check('Units change to yards and are saved on the account', async () => {
    await page.locator('.topbar label[for="u-y"]').click();
    await page.waitForTimeout(400);
    const me = await (await fetch(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })).json();
    assert(me.data.preferences.units === 'imperial', `units are ${me.data.preferences.units}`);
    await page.locator('.round-item a').first().click();
    await page.getByText('Distance (yd)').first().waitFor();
    await page.locator('.topbar label[for="u-m"]').click();
  });

  await check('Deep link: a new tab asks to sign in, then opens that round', async () => {
    const url = page.url();
    const tab = await ctx.newPage(); // sessionStorage is per tab, so no session here
    await tab.goto(url);
    await tab.waitForURL('**/login');
    await tab.fill('#email', email);
    await tab.fill('#password', 'Correct-Horse-7');
    await tab.click('form button[type=submit]');
    await tab.waitForURL(url);
    await tab.locator('.scorecard').first().waitFor();
    await tab.close();
  });

  await check('Settings: export downloads a CSV file', async () => {
    await page.getByRole('link', { name: 'Settings' }).first().click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    assert(/^budget-golfers-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()), download.suggestedFilename());
  });

  await check('Settings: deleting the account needs DELETE typed, then signs out', async () => {
    await page.getByRole('button', { name: 'Delete my account' }).click();
    const dialog = page.getByRole('dialog');
    assert(await dialog.getByRole('button', { name: 'Delete my account' }).isDisabled(), 'confirm should start disabled');
    await dialog.locator('#confirm-delete').fill('DELETE');
    await shot(page, '06-delete-account-dialog');
    await dialog.getByRole('button', { name: 'Delete my account' }).click();
    await page.waitForURL('**/login');
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Correct-Horse-7' }),
    });
    assert(res.status === 401, `the deleted account could still sign in (${res.status})`);
  });
  await ctx.close();

  // ---------- 3. The seeded golfer: every view, for the evidence ----------
  const aroha = await browser.newContext(desktop);
  const p = await aroha.newPage();
  p.on('pageerror', (e) => consoleErrors.push(e.message));

  await check('Dashboard for the seeded golfer (light theme)', async () => {
    await login(p, 'aroha.m@example.com');
    await p.waitForURL('**/dashboard');
    await p.locator('.recharts-line').first().waitFor();
    await p.getByText('HCP', { exact: false }).first().waitFor();
    await shot(p, '07-dashboard');
  });

  await check('API annotations show which request fills each component', async () => {
    await p.locator('#annotate').check();
    await p.locator('.api-tag').first().waitFor({ state: 'visible' });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(300);
    await shot(p, '08-dashboard-api-annotations');
    await p.locator('#annotate').uncheck();
  });

  await check('Round history and filters', async () => {
    await p.goto(`${WEB}/rounds?holes=18`);
    await p.locator('.round-item').first().waitFor();
    await shot(p, '09-rounds');
  });

  await check('Round detail: the A2 example round', async () => {
    await p.goto(`${WEB}/rounds/66f2c9e0b1a2c3d4e5f60718`);
    await p.getByRole('heading', { name: /Omanu Golf Club · 12 Sep 2026/ }).waitFor();
    await shot(p, '10-round-detail');
    await p.locator('.shot-list summary').first().click();
    await p.locator('.shot-list').scrollIntoViewIfNeeded();
    await shot(p, '11-round-detail-shots');
  });

  await check('Clubs: distance bars and the not-enough-data state', async () => {
    await p.getByRole('link', { name: 'Clubs' }).first().click();
    await p.locator('.bar-row').first().waitFor();
    await p.getByText('Not enough data').waitFor();
    await shot(p, '12-clubs');
  });

  await check('Leaderboard: own row highlighted, sort and period chips', async () => {
    await p.getByRole('link', { name: 'Leaderboard' }).first().click();
    await p.locator('tr.me').waitFor();
    await shot(p, '13-leaderboard');
    await p.getByRole('link', { name: 'Most improved' }).click();
    await p.waitForURL('**/leaderboard?sort=improved');
    await p.getByRole('link', { name: 'Last 30 days' }).click();
    await p.waitForURL('**/leaderboard?sort=improved&period=month');
    await p.locator('tr.me').waitFor();
    const opted = await p.locator('tbody').innerText();
    assert(!opted.includes('Hemi T.'), 'an opted-out golfer is on the leaderboard');
  });

  await check('Settings', async () => {
    await p.getByRole('link', { name: 'Settings' }).first().click();
    await p.locator('#dname').waitFor();
    await shot(p, '14-settings');
  });

  await check('Unknown address shows the 404 view', async () => {
    await p.goto(`${WEB}/this/does/not/exist`);
    await p.locator('.not-found').waitFor();
    await shot(p, '15-not-found');
  });
  await aroha.close();

  // ---------- 4. Dark theme and phone layout ----------
  const dark = await browser.newContext(desktop);
  const d = await dark.newPage();
  await check('Dark theme (saved on the account)', async () => {
    await login(d, 'tane.w@example.com');
    await d.waitForURL('**/dashboard');
    await d.locator('.recharts-line').first().waitFor();
    assert(await d.locator('#theme-toggle').isChecked(), 'dark theme is not on');
    await shot(d, '16-dashboard-dark');
    await d.goto(`${WEB}/leaderboard`);
    await d.locator('tr.me').waitFor();
    await shot(d, '17-leaderboard-dark');
  });
  await dark.close();

  const phoneCtx = await browser.newContext({ ...devices['Pixel 7'] });
  const m = await phoneCtx.newPage();
  await check('Phone layout: bottom tab bar under 760 px', async () => {
    await login(m, 'aroha.m@example.com');
    await m.waitForURL('**/dashboard');
    await m.locator('.stat-value').first().waitFor();
    const box = await m.locator('.sidebar').boundingBox();
    const vh = m.viewportSize().height;
    assert(box && box.y + box.height >= vh - 2 && box.height < 120, 'navigation is not a bottom bar');
    await shot(m, '18-phone-dashboard');
    await m.getByRole('link', { name: 'Rounds' }).click();
    await m.locator('.round-item').first().waitFor();
    await shot(m, '19-phone-rounds');
  });
  await phoneCtx.close();

  await check('No JavaScript errors in the browser console', async () => {
    const real = consoleErrors.filter((e) => !/status of 401/.test(e));
    assert(real.length === 0, real.join(' | '));
  });

  await browser.close();

  const summary = { ranAt: new Date().toISOString(), web: WEB, api: API, passed: results.length - failed, failed, results };
  fs.writeFileSync(path.join(OUT, 'e2e-results.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\n${summary.passed} passed, ${failed} failed. Screenshots in docs/test-results/screenshots/`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
