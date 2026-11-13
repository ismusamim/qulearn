// Usage: BASE_URL=http://localhost:3000 node e2e/smoke.mjs [admin|teacher|supervisor|accountant|student]
// Read-only. Expects the demo accounts from prisma/seed.ts.
// Logs in through the real login form as each demo role, opens every sidebar
// link, and reports HTTP errors, console errors and uncaught exceptions.
import { chromium } from "playwright-core";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const USERS = [
  ["المدير", "1234", "admin"],
  ["الشيخ أحمد", "0000", "teacher"],
  ["المشرف خالد", "0000", "supervisor"],
  ["المحاسب سعيد", "0000", "accountant"],
  ["عبد الله", "0000", "student"],
];
const only = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", headless: true });
let failures = 0;
for (const [name, password, key] of USERS) {
  if (only && only !== key) continue;
  const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 }, locale: "ar-EG" });
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text().slice(0, 300)); });
  page.on("response", (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(BASE + "/login");
  await page.fill("#login-name", name);
  await page.fill("#login-password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }).catch(() => problems.push("login did not redirect"));
  await page.waitForLoadState("networkidle");
  const links = await page.$$eval('[data-slot="sidebar"] a[href^="/"]', (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  console.log(`\n== ${key} (${name}) landed on ${new URL(page.url()).pathname}; menu: ${links.join(" ")}`);
  for (const href of links) {
    problems.length = 0;
    const res = await page.goto(BASE + href, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => { problems.push("nav: " + e.message.slice(0, 200)); return null; });
    const h1 = await page.locator("h1").first().textContent({ timeout: 3000 }).catch(() => "(no h1)");
    const overlay = await page.locator("nextjs-portal").count();
    const body = (await page.locator("body").innerText()).slice(0, 4000);
    if (/Application error|Unhandled Runtime Error|This page couldn.t load/.test(body)) problems.push("error page shown");
    const status = res ? res.status() : 0;
    const ok = status === 200 && problems.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? "ok  " : "FAIL"} ${href} [${status}] «${(h1 || "").trim()}»${overlay ? " (dev overlay present)" : ""}`);
    for (const p of [...new Set(problems)]) console.log("     " + p);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${key}${href.replace(/\//g, "_")}.png`, fullPage: false });
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${failures} failing page(s)`);
