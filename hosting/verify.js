// Opens the deployed Hub in headless Chromium and checks that the sign-in screen renders and Supabase answers.
// Usage: node hosting/verify.js https://your-site/            (env CHROME_PATH to use a local Chromium,
//        SKIP_REMOTE=1 to skip the Supabase reachability check, SHOT=path for the screenshot)
const url = process.argv[2];
if (!url) { console.error("usage: node hosting/verify.js <url>"); process.exit(2); }
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  const res = await page.goto(url, { waitUntil: "load", timeout: 90000 });
  if (!res || !res.ok()) throw new Error("page returned HTTP " + (res && res.status()));
  await page.waitForSelector("#hub-auth h1", { timeout: 45000 });
  const h1 = (await page.textContent("#hub-auth h1")).trim();
  console.log("first screen:", h1);
  if (!/^sign in$/i.test(h1)) throw new Error("expected the Sign in screen, got: " + h1);
  const cfg = await page.evaluate(() => window.HUB_CONFIG);
  if (!process.env.SKIP_REMOTE) {
    const r = await fetch(cfg.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/settings", { headers: { apikey: cfg.SUPABASE_ANON_KEY } });
    const body = await r.text();
    if (r.status === 401 || r.status === 403) throw new Error("Supabase rejected the anon key (HTTP " + r.status + "): " + body.slice(0, 200));
    if (!r.ok) console.log("warning: /auth/v1/settings returned HTTP " + r.status + ": " + body.slice(0, 200));
    else { try { const s = JSON.parse(body); console.log("supabase auth:", JSON.stringify({ email_provider: s.external && s.external.email, confirm_email_off: s.mailer_autoconfirm, signups_disabled: s.disable_signup })); } catch (_) { console.log("supabase auth settings:", body.slice(0, 200)); } }
  }
  await page.click('#hub-auth [data-v="register"]');
  await page.waitForSelector("#a_pol", { timeout: 15000 });
  await page.fill("#a_pw", "short1");
  const weak = (await page.$$eval("#a_pol li.y", els => els.length));
  await page.fill("#a_pw", "Longer-passw0rd!");
  const strong = (await page.$$eval("#a_pol li.y", els => els.length));
  const total = await page.$$eval("#a_pol li", els => els.length);
  console.log("policy checklist: weak password passes", weak, "of", total, "; compliant password passes", strong, "of", total);
  if (strong !== total || weak === total) throw new Error("password policy checklist is not behaving");
  await page.screenshot({ path: process.env.SHOT || "verify.png" });
  await browser.close();
  const real = errors.filter(e => !/favicon/i.test(e));
  if (real.length) console.log("browser errors (not fatal):", real.slice(0, 10));
  console.log("OK", url);
})().catch(e => { console.error("VERIFY FAILED:", e.message); process.exit(1); });
