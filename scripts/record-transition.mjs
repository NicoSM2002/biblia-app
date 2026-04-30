// Record the transition as a video so we can actually see the morphing
// behavior frame by frame. Uses WebKit (Safari engine).

import { webkit, devices } from "@playwright/test";
import { mkdirSync } from "fs";

const out = "scripts/videos";
mkdirSync(out, { recursive: true });

const BASE = "http://localhost:3001";

const SLOWDOWN_CSS = `
::view-transition-group(*) {
  animation-duration: 3000ms !important;
}
::view-transition-old(*),
::view-transition-new(*) {
  animation-duration: 3000ms !important;
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
    recordVideo: { dir: out, size: { width: iPhone.viewport.width, height: iPhone.viewport.height } },
  });

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

  const page = await context.newPage();

  // Setup
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  const comenzar = page.locator('button:has-text("Comenzar")');
  if (await comenzar.count()) {
    await comenzar.first().click();
    await page.waitForTimeout(700);
  }

  await page.goto(`${BASE}/misas`);
  await page.waitForTimeout(800);
  await page.locator('[aria-label="Usar mi ubicación"]').click();
  await page.waitForSelector("text=/resultados encontrados/", { timeout: 25000 });
  await page.waitForTimeout(2500);

  // The interesting part — click and let video record the morph
  const firstCard = page.locator("ul li").first();
  await firstCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await firstCard.click();

  // Stay on detail for 6s so the slowed transition fully captures
  await page.waitForTimeout(6000);

  await context.close();
  await browser.close();

  console.log("video saved to scripts/videos/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
