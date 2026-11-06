#!/usr/bin/env node
// Draws og-image.png from assessment.json and points og:image in index.html at it.
//
//   node scripts/og.mjs
//
// Run it after every edit to assessment.json (level or reviewedAt), then run `node --test`.
// Needs Google Chrome or Chromium locally for the screenshot. Set CHROME=/path/to/chrome to
// override the default location. Nothing here ships a dependency or runs on Vercel.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateAssessment } from "../assess.mjs";
import {
  OG_HEIGHT,
  OG_LEVEL_KEY,
  OG_REVIEWED_KEY,
  OG_WIDTH,
  ogImageUrl,
  pngSize,
  withPngText,
} from "./og-meta.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Light-theme level colors from styles.css. Level 1 is the darkest and 5 the calmest.
const COLORS = { 5: "#2f7d5b", 4: "#a8680f", 3: "#c0560f", 2: "#b03a2e", 1: "#8a1c3a" };

function esc(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function shelfMark() {
  return `<svg viewBox="0 0 64 64"><g fill="#2c6b4a">
      <rect x="4" y="4" width="4" height="56" rx="2"/><rect x="56" y="4" width="4" height="56" rx="2"/>
      <rect x="4" y="4" width="56" height="4" rx="2"/><rect x="4" y="56" width="56" height="4" rx="2"/>
      <rect x="4" y="26" width="56" height="3" rx="1" fill-opacity="0.6"/><rect x="4" y="44" width="56" height="3" rx="1" fill-opacity="0.6"/>
      <rect x="12" y="12" width="9" height="14" rx="1.5"/><rect x="25" y="12" width="9" height="14" rx="1.5" fill-opacity="0.8"/>
      <rect x="38" y="12" width="9" height="14" rx="1.5" fill-opacity="0.6"/><rect x="12" y="30" width="10" height="14" rx="2" fill-opacity="0.6"/>
      <rect x="26" y="34" width="10" height="10" rx="2" fill-opacity="0.4"/><rect x="40" y="32" width="10" height="12" rx="2" fill-opacity="0.8"/>
    </g></svg>`;
}

export function reviewedLabel(reviewedAt) {
  const date = new Date(reviewedAt).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return "Reviewed " + date + " UTC";
}

export function renderHtml(assessment) {
  const band = assessment.levels.find((row) => row.level === assessment.level);
  const window = band.window.charAt(0).toLowerCase() + band.window.slice(1);
  const segments = [5, 4, 3, 2, 1]
    .map((n) => {
      const label = n === 5 ? "5 calm" : n === 1 ? "1 critical" : String(n);
      return `<div class="seg${n === assessment.level ? " on" : ""}" style="--c:${COLORS[n]}"><i></i><em>${label}</em></div>`;
    })
    .join("");
  return `<!doctype html>
<meta charset="utf-8">
<style>
  :root { --bg: #f3eee6; --ink: #17241d; --muted: #4e5b54; --line: #cfcabb; --level: ${COLORS[assessment.level]}; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; }
  body { background: var(--bg); color: var(--ink); font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    padding: 56px 72px 48px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 20px; }
  .brand svg { width: 56px; height: 56px; }
  .brand span { font-size: 38px; font-weight: 800; letter-spacing: 0.2em; }
  .main { flex: 1; display: flex; align-items: center; gap: 56px; }
  .badge { width: 230px; height: 230px; border-radius: 36px; flex: none; background: var(--level); color: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .badge small { font-size: 26px; font-weight: 700; letter-spacing: 0.22em; opacity: 0.9; margin-bottom: -6px; }
  .badge b { font-size: 170px; line-height: 1; font-weight: 800; }
  .text h1 { font-size: 68px; line-height: 1.05; font-weight: 800; letter-spacing: -0.015em; }
  .text p { margin-top: 16px; font-size: 32px; color: var(--muted); }
  .scale { display: flex; gap: 8px; margin-top: 30px; width: 640px; }
  .seg { flex: 1; }
  .seg i { display: block; height: 14px; border-radius: 7px; background: var(--c); opacity: 0.22; }
  .seg.on i { opacity: 1; height: 20px; margin-top: -3px; }
  .seg em { display: block; margin-top: 10px; font-style: normal; font-size: 20px; font-weight: 700; color: var(--muted); opacity: 0.7; }
  .seg.on em { color: var(--ink); opacity: 1; }
  .foot { border-top: 2px solid var(--line); padding-top: 20px; display: flex; justify-content: space-between; font-size: 24px; color: var(--muted); }
  .foot strong { color: var(--ink); }
</style>
<body>
  <div class="brand">${shelfMark()}<span>PANTRYCON</span></div>
  <div class="main">
    <div class="badge"><small>LEVEL</small><b>${esc(assessment.level)}</b></div>
    <div class="text">
      <h1>${esc(band.name)}</h1>
      <p>Supply window: ${esc(window)}</p>
      <div class="scale">${segments}</div>
    </div>
  </div>
  <div class="foot">
    <span><strong>Unofficial.</strong> Independent. Not a government or military alert.</span>
    <span>${esc(reviewedLabel(assessment.reviewedAt))}</span>
  </div>
</body>
`;
}

function findChrome() {
  const candidates = [
    process.env.CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error("Chrome not found. Install it or set CHROME=/path/to/chrome.");
  return found;
}

function main() {
  const assessment = JSON.parse(readFileSync(join(root, "assessment.json"), "utf8"));
  const check = validateAssessment(assessment);
  if (!check.ok) throw new Error("assessment.json is invalid:\n" + check.errors.join("\n"));

  const work = mkdtempSync(join(tmpdir(), "pantrycon-og-"));
  try {
    const page = join(work, "og.html");
    const shot = join(work, "og.png");
    writeFileSync(page, renderHtml(assessment));
    execFileSync(findChrome(), [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=" + OG_WIDTH + "," + OG_HEIGHT,
      "--screenshot=" + shot,
      pathToFileURL(page).href,
    ], { stdio: "ignore" });

    const raw = readFileSync(shot);
    const size = pngSize(raw);
    if (size.width !== OG_WIDTH || size.height !== OG_HEIGHT) {
      throw new Error("Screenshot is " + size.width + "x" + size.height + ", expected " + OG_WIDTH + "x" + OG_HEIGHT + ".");
    }
    const png = withPngText(raw, {
      [OG_LEVEL_KEY]: String(assessment.level),
      [OG_REVIEWED_KEY]: assessment.reviewedAt,
    });
    writeFileSync(join(root, "og-image.png"), png);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const indexPath = join(root, "index.html");
  const html = readFileSync(indexPath, "utf8");
  const pattern = /(<meta property="og:image" content=")[^"]*(")/;
  if (!pattern.test(html)) throw new Error('index.html has no <meta property="og:image">.');
  writeFileSync(indexPath, html.replace(pattern, "$1" + ogImageUrl(assessment.reviewedAt) + "$2"));

  console.log("og-image.png drawn for level " + assessment.level + ", reviewed " + assessment.reviewedAt);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
