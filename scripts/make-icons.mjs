// Renders scripts/icon.svg to the PNG app icons in public/icons.
// Run with: node scripts/make-icons.mjs (uses Playwright's Chromium).
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
const page = await browser.newPage();

async function render(file, size, padding = 0) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - padding * 2;
  // Maskable icons need the artwork inside the central safe zone, on a full-bleed background
  await page.setContent(
    `<body style="margin:0;background:#4f46e5;display:grid;place-items:center;height:${size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body>`,
  );
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: padding === 0 });
}

await render("icon-192.png", 192);
await render("icon-512.png", 512);
await render("icon-maskable-512.png", 512, 64);
await render("apple-touch-icon.png", 180, 12);
await browser.close();
