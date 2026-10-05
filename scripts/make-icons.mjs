// Renders scripts/icon.svg to the PNG app icons in public/icons.
// Run with: node scripts/make-icons.mjs (uses Playwright's Chromium).
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
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

// favicon.ico: an ICO file holding one 48px PNG (supported by every current browser)
await render("favicon-48.png", 48);
const png = readFileSync("public/icons/favicon-48.png");
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(48, 6); // width
header.writeUInt8(48, 7); // height
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18); // offset of the image data
writeFileSync("public/favicon.ico", Buffer.concat([header, png]));
unlinkSync("public/icons/favicon-48.png");
await browser.close();
