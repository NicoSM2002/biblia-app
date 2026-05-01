// Reproduce the theme bug in a private/incognito context — NO localStorage,
// NO sessionStorage, NO cookies from previous sessions. If the page still
// opens with the wrong theme, the bug is in our code, not in stale state.

import { webkit, devices } from "@playwright/test";

const BASE = "http://localhost:3001";

async function main() {
  const browser = await webkit.launch({ headless: true });

  // Force a context that emulates dark OS preference + private (no storage).
  // This is the worst case: an iPhone in dark mode opening incognito.
  const context = await browser.newContext({
    ...devices["iPhone 14"],
    colorScheme: "dark", // emulate iOS dark mode
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2000); // wait for splash to dismiss
  // Hide the Next.js dev overlay so it doesn't intercept clicks
  await page.addStyleTag({
    content: `nextjs-portal, [data-nextjs-toast] { display: none !important; }`,
  });

  const themeAttr = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme"),
  );
  const bodyBg = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  console.log(`After load: data-theme=${themeAttr}, body bg=${bodyBg}`);

  // Try clicking the toggle once and see what happens
  const toggle = page.locator('button[aria-label*="modo"]').first();
  if (await toggle.count()) {
    console.log("\n--- Click 1 ---");
    await toggle.click();
    await page.waitForTimeout(400);
    const t1 = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    const bg1 = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    console.log(`After click 1: data-theme=${t1}, body bg=${bg1}`);

    console.log("\n--- Click 2 ---");
    await toggle.click();
    await page.waitForTimeout(400);
    const t2 = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    const bg2 = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    console.log(`After click 2: data-theme=${t2}, body bg=${bg2}`);
  } else {
    console.log("Toggle button not found");
  }

  // Test bottom-nav lag: click between tabs and time the navigation
  console.log("\n--- Bottom nav timing ---");
  const tabs = ["/chat", "/oracion", "/misas", "/"];
  for (const href of tabs) {
    const link = page.locator(`a[href="${href}"]`).first();
    const t0 = Date.now();
    await link.click();
    await page.waitForURL(`**${href}`);
    const t1 = Date.now();
    console.log(`${href}: ${t1 - t0}ms`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
