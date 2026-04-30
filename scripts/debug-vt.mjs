// Probe: does this browser support View Transitions API at all? And is
// our slowdown CSS getting applied to the pseudo-elements?

import { webkit, chromium, devices } from "@playwright/test";

const BASE = "http://localhost:3001";

async function probe(name, browserType) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ ...devices["iPhone 14"] });

  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.id = "test-slowdown";
    style.textContent = `
      ::view-transition-group(*) { animation-duration: 4000ms !important; }
      ::view-transition-old(*), ::view-transition-new(*) { animation-duration: 4000ms !important; }
    `;
    if (document.head) document.head.appendChild(style);
    else document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
  });

  const page = await context.newPage();

  await page.goto(`${BASE}/misas`);
  await page.waitForTimeout(1000);

  const slowdownPresent = await page.evaluate(() => {
    return !!document.getElementById("test-slowdown");
  });
  console.log(`slowdown style tag present: ${slowdownPresent}`);

  const supportsVT = await page.evaluate(() => {
    return typeof document.startViewTransition === "function";
  });

  // Check if our CSS variables / rules made it
  const navStyle = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Navegación principal"]');
    if (!nav) return "no nav";
    return {
      vtName: getComputedStyle(nav).viewTransitionName,
      bg: getComputedStyle(nav).backgroundColor,
    };
  });

  console.log(`\n=== ${name} ===`);
  console.log(`startViewTransition: ${supportsVT}`);
  console.log(`bottom nav style:`, navStyle);

  await browser.close();
}

await probe("WebKit", webkit);
await probe("Chromium", chromium);
