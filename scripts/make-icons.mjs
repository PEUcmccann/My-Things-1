// Draws the MyThings icon, splash and favicon into assets/, and the Home Screen icons for the
// web app into public/, with headless Chrome.
// Run with: node scripts/make-icons.mjs
import { chromium } from "@playwright/test";

const mark = `
  <!-- Three list bars with a ticked circle on the first: MyThings' own mark. -->
  <circle cx="330" cy="370" r="92" fill="none" stroke="#FFFFFF" stroke-width="40"/>
  <path d="M288 372 L320 404 L372 338" fill="none" stroke="#FFFFFF" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="470" y="340" width="300" height="60" rx="30" fill="#FFFFFF"/>
  <rect x="254" y="540" width="516" height="60" rx="30" fill="#FFFFFF" opacity="0.85"/>
  <rect x="254" y="680" width="380" height="60" rx="30" fill="#FFFFFF" opacity="0.65"/>
`;
const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14A3A0"/><stop offset="1" stop-color="#0B6466"/></linearGradient></defs>`;
const svg = (size, { bg = true, round = false, scale = 1, color } = {}) => {
  let m = mark;
  if (color) m = m.replaceAll("#FFFFFF", color);
  const t = `translate(${512 * (1 - scale)} ${512 * (1 - scale)}) scale(${scale})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${grad}${
    bg ? `<rect width="1024" height="1024" ${round ? 'rx="224"' : ""} fill="url(#g)"/>` : ""
  }<g transform="${t}">${m}</g></svg>`;
};
const out = new URL("../assets/", import.meta.url).pathname;
const jobs = [
  ["icon.png", 1024, { bg: true }],
  ["splash-icon.png", 1024, { bg: true, round: true }],
  ["favicon.png", 48, { bg: true, round: true }],
  ["android-icon-foreground.png", 1024, { bg: false, scale: 0.66 }],
  ["android-icon-monochrome.png", 1024, { bg: false, scale: 0.66, color: "#000000" }],
  // Square and opaque: iOS rounds the corners itself and fills transparency with black.
  ["../public/apple-touch-icon.png", 180, { bg: true }],
  ["../public/icon-512.png", 512, { bg: true }],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, opts] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(size, opts)}</body></html>`,
  );
  await page.locator("svg").screenshot({ path: out + name, omitBackground: true });
}
// The adaptive icon background is the gradient alone.
await page.setViewportSize({ width: 1024, height: 1024 });
await page.setContent(
  `<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${grad}<rect width="1024" height="1024" fill="url(#g)"/></svg></body></html>`,
);
await page.locator("svg").screenshot({ path: out + "android-icon-background.png" });
await browser.close();
