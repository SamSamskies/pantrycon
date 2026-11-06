import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OG_HEIGHT,
  OG_LEVEL_KEY,
  OG_REVIEWED_KEY,
  OG_WIDTH,
  ogImageUrl,
  pngSize,
  readPngText,
  withPngText,
} from "../scripts/og-meta.mjs";
import { renderHtml, reviewedLabel } from "../scripts/og.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const assessment = JSON.parse(readFileSync(join(root, "assessment.json"), "utf8"));
const image = readFileSync(join(root, "og-image.png"));
const html = readFileSync(join(root, "index.html"), "utf8");
const fix = "Run `node scripts/og.mjs` after editing assessment.json.";

test("og-image.png was drawn from the current level and review time", () => {
  const text = readPngText(image);
  assert.equal(text[OG_LEVEL_KEY], String(assessment.level), "level is out of date. " + fix);
  assert.equal(text[OG_REVIEWED_KEY], assessment.reviewedAt, "reviewedAt is out of date. " + fix);
  assert.deepEqual(pngSize(image), { width: OG_WIDTH, height: OG_HEIGHT });
});

test("index.html points og:image at the image for this review", () => {
  const tag = html.match(/<meta property="og:image" content="([^"]*)"/);
  assert.ok(tag, "og:image tag exists");
  assert.equal(tag[1], ogImageUrl(assessment.reviewedAt), "og:image version is out of date. " + fix);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
});

test("the share image text is written into the PNG without damaging it", () => {
  const stripped = withPngText(image, { [OG_LEVEL_KEY]: "2", [OG_REVIEWED_KEY]: "x" });
  assert.deepEqual(readPngText(stripped), { [OG_LEVEL_KEY]: "2", [OG_REVIEWED_KEY]: "x" });
  assert.deepEqual(pngSize(stripped), pngSize(image));
});

test("the share image markup uses only the assessment, for every level", () => {
  assert.equal(reviewedLabel("2026-11-06T20:12:00Z"), "Reviewed Nov 6, 2026 UTC");
  assessment.levels.forEach((band) => {
    const page = renderHtml({ ...assessment, level: band.level });
    assert.ok(page.includes("<b>" + band.level + "</b>"), "level " + band.level);
    assert.ok(page.includes(band.name), band.name);
    assert.ok(page.includes(reviewedLabel(assessment.reviewedAt)));
    assert.match(page, /Unofficial\./);
    assert.match(page, /Not a government or military alert/);
    assert.equal((page.match(/class="seg/g) || []).length, 5);
    assert.equal((page.match(/class="seg on"/g) || []).length, 1);
  });
});
