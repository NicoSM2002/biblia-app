// Reproduces the church-photo / bottom-nav transition bug as the user sees
// it on iPhone. We emulate iPhone 14 (390x844, DPR 3).
//
// Trick: we override the view-transition animation duration to 5 seconds
// at runtime so Playwright can actually capture the mid-transition state.
// Otherwise the 280-420ms transition completes between two screenshots.

import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "fs";

const out = "scripts/screenshots";
mkdirSync(out, { recursive: true });

const BASE = "http://localhost:3001";

const SLOWDOWN_CSS = `
::view-transition-group(root) {
  animation-duration: 5000ms !important;
}
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 5000ms !important;
}
::view-transition-group(*) {
  animation-duration: 5000ms !important;
}
::view-transition-old(*),
::view-transition-new(*) {
  animation-duration: 5000ms !important;
}
::view-transition-group(bottom-nav),
::view-transition-old(bottom-nav),
::view-transition-new(bottom-nav) {
  animation: none !important;
}
`;

async function main() {
  const iPhone = devices["iPhone 14"];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...iPhone,
    permissions: ["geolocation"],
    geolocation: { latitude: 5.5353, longitude: -73.367 },
  });
  const page = await context.newPage();

  // Inject the slowdown CSS via init script so it applies on every nav
  await context.addInitScript(({ css }) => {
    const style = document.createElement("style");
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }, { css: SLOWDOWN_CSS + `
    [data-nextjs-toast], nextjs-portal { display: none !important; }
  ` });

  // 1. Land on home, dismiss daily verse
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  const comenzar = page.locator('button:has-text("Comenzar")');
  if (await comenzar.count()) {
    await comenzar.first().click();
    await page.waitForTimeout(700);
  }

  // 2. Go to /misas, search, wait for results
  await page.goto(`${BASE}/misas`);
  await page.waitForTimeout(800);
  await page.locator('[aria-label="Usar mi ubicación"]').click();
  await page.waitForSelector("text=/resultados encontrados/", { timeout: 20000 });
  await page.waitForTimeout(1500); // let images load

  // 3. Tap the FIRST church card and capture mid-transition
  const firstCard = page.locator("ul li").first();
  await firstCard.scrollIntoViewIfNeeded();

  // Trigger the click — note view-transition is now 5s long thanks to override
  await firstCard.click();

  // Capture frames at 200ms intervals during the 5s transition
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/midtrans-${String(i).padStart(2, "0")}.png` });
  }

  // After the transition is done
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/final-detail.png` });

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
