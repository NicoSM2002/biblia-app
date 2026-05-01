// Verify animations are actually running. Records video at native speed
// THEN at 5x slowdown so we can see them frame by frame.
//
// Tests:
// 1. View transition between bottom-nav tabs
// 2. page-content-fade on each page mount
// 3. Card → detail navigation transition
// 4. Daily verse skeleton → real content
//
// Output: scripts/anim-check/native.webm + slow.webm + JSON report

import { webkit, devices } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3001";
const out = "scripts/anim-check";
mkdirSync(out, { recursive: true });

async function probe(label, slowdownMs) {
  const browser = await webkit.launch({ headless: true });
  const ctx = await browser.newContext({
    ...devices["iPhone 14"],
    permissions: ["geolocation"],
    geolocation: { latitude: 5.5353, longitude: -73.367 },
    recordVideo: { dir: out, size: { width: 390, height: 844 } },
  });

  // Always hide the Next.js dev overlays so they don't intercept clicks.
  // If slowdownMs > 0, also override animation durations.
  await ctx.addInitScript((ms) => {
    const apply = () => {
      const style = document.createElement("style");
      style.id = "_anim_probe_slow";
      const slow = ms > 0 ? `
        ::view-transition-old(root), ::view-transition-new(root),
        ::view-transition-group(root) {
          animation-duration: ${ms}ms !important;
        }
        .page-content-fade, .soft-fade-in {
          animation-duration: ${ms}ms !important;
        }
      ` : "";
      style.textContent = `
        [data-nextjs-toast], nextjs-portal { display: none !important; pointer-events: none !important; }
        ${slow}
      `;
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", apply);
    } else {
      apply();
    }
  }, slowdownMs);

  const page = await ctx.newPage();

  // Capture computed animation info as we go
  const probeAnimation = async (selector, name) => {
    return page.evaluate(({ sel, n }) => {
      const el = document.querySelector(sel);
      if (!el) return { error: `not found: ${sel}` };
      const cs = getComputedStyle(el);
      return {
        name: n,
        animationName: cs.animationName,
        animationDuration: cs.animationDuration,
        animationFillMode: cs.animationFillMode,
        opacity: cs.opacity,
      };
    }, { sel: selector, n: name });
  };

  console.log(`\n=== ${label} ===`);

  // 1. Initial load — does page-content-fade exist on the home main?
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2000);
  console.log("Home loaded");
  console.log("  main fade-in:", await probeAnimation(".page-content-fade", "page-content-fade"));

  // 2. Click "Conversación" — capture the view transition
  const chatLink = page.locator('a[href="/chat"]').first();
  console.log("\nClicking → /chat");
  await chatLink.click();
  await page.waitForURL("**/chat");
  await page.waitForTimeout(slowdownMs > 0 ? 4000 : 800);
  console.log("On /chat");
  console.log("  main fade-in:", await probeAnimation(".page-content-fade", "page-content-fade-chat"));

  // 3. Click "Parroquias"
  const misasLink = page.locator('a[href="/misas"]').first();
  console.log("\nClicking → /misas");
  await misasLink.click();
  await page.waitForURL("**/misas");
  await page.waitForTimeout(slowdownMs > 0 ? 4000 : 800);

  // Use my location and wait for results
  await page.locator('[aria-label="Usar mi ubicación"]').click();
  await page.waitForSelector("text=/resultados encontrados/", { timeout: 25000 });
  await page.waitForTimeout(2000);

  // 4. Click first card → detail (this is what user says has "no animation")
  console.log("\nClicking first parish card → detail");
  const firstCard = page.locator("ul li").first();
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click();
  await page.waitForURL(/\/misas\/.+/);
  await page.waitForTimeout(slowdownMs > 0 ? 5000 : 1500);

  // 5. Back to home
  console.log("\nClicking → /");
  await page.locator('a[href="/"]').first().click();
  await page.waitForURL(/\/$/);
  await page.waitForTimeout(slowdownMs > 0 ? 4000 : 800);

  await ctx.close();
  await browser.close();
}

await probe("native speed", 0);
await probe("5x slowdown", 1500);

console.log("\nVideos in", out);
