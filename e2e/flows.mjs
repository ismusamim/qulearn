// Exercises real writes through the UI and checks access control.
// WRITES TEST DATA (attendance, a recitation, a place «دار الأرقم التجريبية»):
// run it against the local Docker database, not production.
// Usage: BASE_URL=http://localhost:3000 node e2e/flows.mjs
import { chromium } from "playwright-core";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", headless: true });
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

async function login(name, password) {
  const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("     pageerror:", e.message.slice(0, 200)));
  await page.goto(BASE + "/login");
  await page.fill("#login-name", name);
  await page.fill("#login-password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  return { ctx, page };
}

// 1. Wrong password is refused.
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#login-name", "المدير"); await page.fill("#login-password", "9999");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  check("wrong password refused", page.url().includes("/login") && (await page.locator("text=الاسم أو كلمة المرور غير صحيحة").count()) > 0);
  // Suggestions: typing part of a name shows it with its role; admin never suggested.
  await page.fill("#login-name", "الشيخ");
  await page.waitForSelector("#login-name-results", { timeout: 5000 }).catch(() => {});
  check("login suggests names", (await page.locator("#login-name-results >> text=الشيخ أحمد").count()) > 0);
  await page.fill("#login-name", "المدي");
  await page.waitForTimeout(800);
  check("admin is never suggested", (await page.locator("#login-name-results >> text=المدير").count()) === 0);
  await ctx.close();
}

// 2. Teacher marks attendance and records a recitation.
{
  const { ctx, page } = await login("الشيخ أحمد", "0000");
  await page.goto(BASE + "/attendance", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "الكل حاضر" }).click();
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "networkidle" });
  const summary = await page.locator("text=/حاضر:\\s*3/").count();
  check("teacher: «الكل حاضر» persisted after reload", summary > 0);

  await page.goto(BASE + "/my-students", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /تسجيل تسميع/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  // The surah picker shows the current surah (الفاتحة); open it and search.
  await dialog.locator("button", { hasText: "الفاتحة" }).click();
  await page.keyboard.type("الملك");
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  const ayat = dialog.locator("input:not([type=date])");
  await ayat.nth(0).fill("1");
  await ayat.nth(1).fill("10");
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/flow_recitation_dialog.png" });
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await page.waitForTimeout(2500);
  const toastErr = await page.locator("[data-sonner-toast][data-type=error]").allInnerTexts();
  await page.reload({ waitUntil: "networkidle" });
  const recorded = await page.locator("text=/الملك/").count();
  check("teacher: recitation recorded", recorded > 0, toastErr.join(" | "));
  await ctx.close();
}

// 3. Admin creates a place.
{
  const { ctx, page } = await login("المدير", "1234");
  await page.goto(BASE + "/halaqat", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "مكان جديد" }).click();
  await page.fill("#place-name", "دار الأرقم التجريبية");
  await page.getByRole("dialog").getByRole("button", { name: "حفظ" }).click();
  await page.waitForTimeout(2000);
  check("admin: place created", (await page.locator("text=دار الأرقم التجريبية").count()) > 0);
  // Payroll should now open on the current month.
  await page.goto(BASE + "/payroll", { waitUntil: "networkidle" });
  check("payroll opens on the current month", (await page.locator("text=نوفمبر").count()) > 0);
  await ctx.close();
}

// 4. Access control: non-admins are sent away from admin pages.
for (const [name, pw, paths] of [["عبد الله", "0000", ["/payroll", "/members", "/attendance", "/fees"]], ["المحاسب سعيد", "0000", ["/payroll", "/members", "/settings"]], ["الشيخ أحمد", "0000", ["/payroll", "/students", "/import"]]]) {
  const { ctx, page } = await login(name, pw);
  for (const p of paths) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    const landed = new URL(page.url()).pathname;
    check(`${name} cannot open ${p}`, landed !== p, `landed on ${landed}`);
  }
  // Export route handler must refuse non-admins.
  const res = await page.request.get(BASE + "/import/export");
  check(`${name}: backup export refused`, res.status() >= 300 && res.status() !== 200, `HTTP ${res.status()}`);
  await ctx.close();
}

// 5. Signed-out requests are redirected.
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(BASE + "/dashboard");
  check("signed-out user redirected to login", new URL(page.url()).pathname === "/login");
  await ctx.close();
}

await browser.close();
console.log(`\n${results.filter((r) => !r).length} failure(s) of ${results.length}`);
