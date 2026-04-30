// Deep-debug the /misas → /misas/[id] transition: capture console logs +
// network requests + view-transition pseudos to figure out why the user
// reports "no transition" + "elements refresh".

import { webkit, devices } from "@playwright/test";
import { mkdirSync } from "fs";

const out = "scripts/debug-misas";
mkdirSync(out, { recursive: true });

const BASE = "http://localhost:3001";

async function main() {
  const iPhone = devices["iPhone 14"];
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...iPhone,
    permissions: ["geolocation"],
    geolocation: { latitude: 5.5353, longitude: -73.367 },
    recordVideo: { dir: out, size: { width: iPhone.viewport.width, height: iPhone.viewport.height } },
  });

  // Slow the view-transition to 5s so screenshots can capture it
  await context.addInitScript(() => {
    const apply = () => {
      const style = document.createElement("style");
      style.textContent = `
        ::view-transition-old(root) { animation-duration: 5000ms !important; }
        ::view-transition-new(root) { animation-duration: 5000ms !important; }
        [data-nextjs-toast], nextjs-portal { display: none !important; }
      `;
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", apply);
    } else {
      apply();
    }
  });

  const page = await context.newPage();

  // Capture console output
  const logs = [];
  page.on("console", (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    logs.push(`[pageerror] ${err.message}`);
  });

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
  await page.waitForTimeout(2000);

  console.log("Before click — console messages:", logs.length);
  console.log("Sample logs:", logs.slice(-5).join("\n"));

  // Click the first card
  const firstCard = page.locator("ul li").first();
  await firstCard.scrollIntoViewIfNeeded();

  console.log("\n=== CLICKING CARD ===");
  await firstCard.click();
  await page.waitForTimeout(200);

  console.log("After click — recent console messages:");
  console.log(logs.slice(-20).join("\n"));

  // Wait for the slow transition to complete + extra time
  await page.waitForTimeout(8000);

  console.log("\nFinal recent logs:");
  console.log(logs.slice(-10).join("\n"));

  // Inspect view-transition pseudos in DOM during transition
  // (we already waited so transition is done — but we can check final state)
  const finalUrl = page.url();
  console.log(`\nFinal URL: ${finalUrl}`);

  await context.close();
  await browser.close();
  console.log("\ndone — video in scripts/debug-misas/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
