// Reproduces the church-photo / bottom-nav transition bug as the user sees
// it on iPhone. Uses WebKit (Safari engine) instead of Chromium for closer
// fidelity to real iOS Safari behavior.
//
// We slow the view-transition animations to 5 seconds at runtime via an
// init script so Playwright can actually screenshot the in-progress state.

import { webkit, devices } from "@playwright/test";
import { mkdirSync } from "fs";

const out = "scripts/screenshots-webkit";
mkdirSync(out, { recursive: true });

const BASE = "http://localhost:3001";

const SLOWDOWN_CSS = `
::view-transition-group(*) {
  animation-duration: 4000ms !important;
}
::view-transition-old(*),
::view-transition-new(*) {
  animation-duration: 4000ms !important;
}
::view-transition-group(bottom-nav),
::view-transition-old(bottom-nav),
::view-transition-new(bottom-nav) {
  animation: none !important;
}
[data-nextjs-toast], nextjs-portal { display: none !important; }
`;

async function main() {
  const iPhone = devices["iPhone 14"];
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...iPhone,
    permissions: ["geolocation"],
    geolocation: { latitude: 5.5353, longitude: -73.367 },
  });
  const page = await context.newPage();

  await context.addInitScript(({ css }) => {
    const apply = () => {
      const style = document.createElement("style");
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", apply);
    } else {
      apply();
    }
  }, { css: SLOWDOWN_CSS });

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
  await page.waitForSelector("text=/resultados encontrados/", { timeout: 25000 });
  await page.waitForTimeout(2000); // let images load

  await page.screenshot({ path: `${out}/01-list.png` });

  // Scroll to bottom
  await page.evaluate(() => {
    const main = document.querySelector("main");
    main?.scrollTo({ top: 99999, behavior: "instant" });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/02-list-bottom.png` });
  await page.evaluate(() => {
    const main = document.querySelector("main");
    main?.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(300);

  // 3. Tap the FIRST church card and capture mid-transition.
  //    Because we slowed view-transition to 4s, screenshots taken at
  //    300ms intervals will catch the morph in progress.
  const firstCard = page.locator("ul li").first();
  await firstCard.scrollIntoViewIfNeeded();

  // Trigger the click without awaiting (the navigation will resolve when
  // the transition is done; we just want to capture frames during it).
  firstCard.click().catch(() => {});

  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(280);
    await page.screenshot({ path: `${out}/03-trans-${String(i).padStart(2, "0")}.png` });
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/04-detail-final.png` });

  await browser.close();
  console.log("done — screenshots in scripts/screenshots-webkit/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
