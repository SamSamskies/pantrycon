import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE_URLS,
  loadSharedView,
  nationalFields,
  presentAssessment,
  safeHref,
  validateAssessment,
} from "../assess.mjs";
import { paintSite } from "../site.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const assessment = JSON.parse(readFileSync(join(root, "assessment.json"), "utf8"));

function memoryStore(initial) {
  const data = new Map(initial || []);
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
  };
}

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

function makeEl(doc, tag) {
  return {
    tag,
    ownerDocument: doc,
    children: [],
    attrs: {},
    className: "",
    textContent: "",
    hidden: false,
    get firstChild() { return this.children[0] || null; },
    append(...kids) { kids.forEach((kid) => this.appendChild(kid)); },
    appendChild(kid) { this.children.push(kid); return kid; },
    removeChild(kid) {
      this.children = this.children.filter((child) => child !== kid);
      return kid;
    },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name]; },
    addEventListener() {},
  };
}

function makeDoc() {
  const nodes = new Map();
  const doc = {
    documentElement: { dataset: {} },
    location: { href: "https://pantrycon.example/" },
    defaultView: { navigator: {} },
    querySelector(selector) {
      return selector.startsWith("#") ? nodes.get(selector.slice(1)) || null : null;
    },
    createElement(tag) { return makeEl(doc, tag); },
  };
  [
    "disclaimer", "overrides", "load-state", "hero", "details", "level-kicker", "level-num",
    "level-name", "headline", "summary", "scope", "window", "reviewed", "warning", "rationale",
    "scale", "evidence", "raise", "lower", "levels", "check-intro", "checklist", "methodology",
    "limitations", "sources", "share",
  ].forEach((id) => nodes.set(id, makeEl(doc, "div")));
  return doc;
}

const reviewedMs = Date.parse(assessment.reviewedAt);

test("canonical assessment matches the contract", () => {
  const result = validateAssessment(assessment);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(assessment.level, 4);
  assert.equal(assessment.scope.weighting, "national");
  assert.equal(assessment.levels.length, 5);
  assert.deepEqual(
    assessment.evidence.map((item) => item.status).filter((status, index, all) => all.indexOf(status) === index).sort(),
    ["confirmed", "developing", "unverified"]
  );
  const factors = assessment.evidence.map((item) => item.factor);
  ["energy", "grid", "supply-chain", "cyber", "weather", "civil", "geopolitical"].forEach((factor) => {
    assert.ok(factors.includes(factor), factor);
  });
});

test("public files do not carry personal, local, or official-alert claims", () => {
  const banned = [
    /austin/i,
    /ercot/i,
    /pentagon/i,
    /already stocked/i,
    /samsam/i,
    /gmail/i,
    /api[_-]?key/i,
    /\bpassword\b/i,
  ];
  ["assessment.json", "index.html", "site.js", "assess.mjs", "styles.css", "schema.json"].forEach((name) => {
    const text = readFileSync(join(root, name), "utf8");
    banned.forEach((pattern) => assert.equal(pattern.test(text), false, name + " matched " + pattern));
  });
  assert.equal(/%/.test(JSON.stringify(assessment)), false);
});

test("the public page and a dashboard read produce the same national fields", async () => {
  const fetchImpl = async (url) => {
    assert.ok(url === "assessment.json" || url.endsWith("/assessment.json"));
    return jsonResponse(assessment);
  };
  const now = reviewedMs + 60 * 1000;
  const site = await loadSharedView({
    fetchImpl,
    urls: SITE_URLS,
    storage: memoryStore(),
    now,
  });
  const dashboard = await loadSharedView({
    fetchImpl,
    urls: ["https://raw.githubusercontent.com/example/pantrycon/main/assessment.json"],
    storage: memoryStore(),
    now,
  });
  assert.equal(site.mode, "current");
  assert.deepEqual(nationalFields(site), nationalFields(dashboard));
  assert.equal(nationalFields(site).level, "4");
  assert.equal(nationalFields(site).rationale, assessment.rationale);
  assert.equal(site.reviewedAt, assessment.reviewedAt);
  assert.equal(nationalFields(site).warning, "");
});

test("a stale snapshot keeps the level and review time", () => {
  const now = reviewedMs + assessment.staleAfterHours * 60 * 60 * 1000 + 1;
  const view = presentAssessment(assessment, { now });
  const fields = nationalFields(view);
  assert.equal(view.mode, "stale");
  assert.equal(fields.level, "4");
  assert.equal(fields.rationale, assessment.rationale);
  assert.match(fields.warning, /saved snapshot, not a live feed/);
  assert.match(fields.warning, /36-hour/);
});

test("the exact review window is still current", () => {
  const now = reviewedMs + assessment.staleAfterHours * 60 * 60 * 1000;
  assert.equal(presentAssessment(assessment, { now }).mode, "current");
});

test("a failed fetch with no cache shows no level", async () => {
  const view = await loadSharedView({
    fetchImpl: async () => { throw new Error("offline"); },
    urls: SITE_URLS,
    storage: memoryStore(),
    now: reviewedMs,
  });
  assert.equal(view.mode, "error");
  assert.equal(view.level, null);
  assert.equal(nationalFields(view).level, "");
  assert.match(view.warning, /No level is shown/);
  assert.match(view.warning, /not an all-clear/);
  const doc = makeDoc();
  paintSite(doc, view);
  assert.equal(doc.querySelector("#load-state").textContent, view.warning);
  assert.equal(doc.querySelector("#hero").hidden, true);
  assert.equal(doc.querySelector("#level-num").textContent, "");
});

test("a failed refresh shows the last saved review time", async () => {
  const storage = memoryStore([
    ["pantrycon-assessment-v1", JSON.stringify({ assessment })],
  ]);
  let calls = 0;
  const view = await loadSharedView({
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ error: "nope" }, false, 503);
    },
    urls: ["/api/pantrycon", "assessment.json"],
    storage,
    now: reviewedMs,
  });
  assert.equal(calls, 2);
  assert.equal(view.mode, "cached-error");
  assert.equal(view.level, 4);
  assert.equal(view.reviewedAt, assessment.reviewedAt);
  assert.match(view.warning, /could not be refreshed/);
  assert.match(view.warning, /not a live reading/);
});

test("the first good source wins when an earlier one fails", async () => {
  const urls = [];
  const view = await loadSharedView({
    fetchImpl: async (url) => {
      urls.push(url);
      if (urls.length === 1) return jsonResponse({}, false, 404);
      return jsonResponse(assessment);
    },
    urls: ["/api/pantrycon", "/pantrycon/assessment.json"],
    storage: memoryStore(),
    now: reviewedMs,
  });
  assert.deepEqual(urls, ["/api/pantrycon", "/pantrycon/assessment.json"]);
  assert.equal(view.level, assessment.level);
});

test("invalid levels and script links are rejected", () => {
  const broken = structuredClone(assessment);
  broken.level = 0;
  assert.equal(validateAssessment(broken).ok, false);
  assert.equal(safeHref("javascript:alert(1)"), "");
  assert.equal(safeHref("https://www.ready.gov/kit").startsWith("https://"), true);
});

test("the page paints the shared level, evidence, and checklist", () => {
  const view = presentAssessment(assessment, { now: reviewedMs });
  const doc = makeDoc();
  const fields = paintSite(doc, view);
  assert.equal(fields.level, "4");
  assert.equal(doc.querySelector("#level-num").textContent, "4");
  assert.equal(doc.querySelector("#rationale").textContent, assessment.rationale);
  assert.equal(doc.querySelector("#reviewed").getAttribute("datetime"), assessment.reviewedAt);
  assert.equal(doc.documentElement.dataset.level, "4");
  assert.equal(doc.querySelector("#evidence").children.length, assessment.evidence.length);
  assert.equal(doc.querySelector("#checklist").children.length, assessment.checklist.groups.length);
  assert.equal(doc.querySelector("#levels").children.length, 5);
  assert.match(doc.querySelector("#disclaimer").textContent, /not DEFCON/);
  assert.match(doc.querySelector("#overrides").textContent, /always override/);
});

test("the hero does not repeat the level name as a second headline", () => {
  const view = presentAssessment(assessment, { now: reviewedMs });
  assert.equal(view.levelName, assessment.headline);
  const doc = makeDoc();
  paintSite(doc, view);
  assert.equal(doc.querySelector("#level-name").textContent, "Top Off the Pantry");
  assert.equal(doc.querySelector("#headline").hidden, true);
  assert.equal(doc.querySelector("#headline").textContent, "");

  const distinct = structuredClone(assessment);
  distinct.headline = "Keep two weeks on hand";
  const other = makeDoc();
  paintSite(other, presentAssessment(distinct, { now: reviewedMs }));
  assert.equal(other.querySelector("#headline").hidden, false);
  assert.equal(other.querySelector("#headline").textContent, "Keep two weeks on hand");
});

test("the level meter marks only the current level and does not repeat level names", () => {
  const doc = makeDoc();
  paintSite(doc, presentAssessment(assessment, { now: reviewedMs }));
  const items = doc.querySelector("#scale").children;
  assert.equal(items.length, 5);
  assert.deepEqual(items.map((li) => li.children[2].textContent), ["5", "4", "3", "2", "1"]);
  assert.deepEqual(items.map((li) => li.getAttribute("aria-current")), [undefined, "true", undefined, undefined, undefined]);
  assert.equal(items[1].children[0].textContent, "Current");
});

test("the page keeps one short unofficial note above the fold", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const brief = html.match(/id="brief">([^<]+)</);
  assert.ok(brief && brief[1].length < 160, "brief note is short");
  assert.match(brief[1], /unofficial/i);
  assert.ok(html.indexOf('id="brief"') < html.indexOf('id="why"'));
  assert.ok(html.indexOf('id="hero"') < html.indexOf('id="method-section"'));
  assert.ok(html.indexOf('id="source-section"') > html.indexOf('id="checklist-section"'));
});

test("the static page does not hard-code a level", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.match(html, /assessment\.json/);
  assert.match(html, /site\.js/);
  assert.equal(/PANTRYCON\s*[1-5]/.test(html), false);
  const names = readdirSync(root);
  ["index.html", "assessment.json", "assess.mjs", "site.js", "styles.css", "vercel.json", "favicon.svg"].forEach((name) => {
    assert.ok(names.includes(name), name);
  });
});
