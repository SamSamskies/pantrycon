/**
 * Shared PANTRYCON reader. The assessment file is the only fact source.
 * Both the public page and the household dashboard use this state machine:
 * current, stale, cached-error, and error.
 */

export const CACHE_KEY = "pantrycon-assessment-v1";
export const SITE_URLS = ["assessment.json"];
export const STATUSES = ["confirmed", "developing", "unverified"];

const REQUIRED_TEXT = [
  "headline",
  "summary",
  "rationale",
  "supplyWindow",
  "disclaimer",
  "overrides",
  "methodology",
];

export function safeHref(href) {
  if (typeof href !== "string") return "";
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("//") || /^javascript:/i.test(trimmed)) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("/\\")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch (err) {
    return "";
  }
  return "";
}

export function validateAssessment(data) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, errors: ["Assessment must be an object."] };
  }
  if (data.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (data.instrument !== "PANTRYCON") errors.push("instrument must be PANTRYCON.");
  if (!Number.isInteger(data.level) || data.level < 1 || data.level > 5) {
    errors.push("level must be an integer from 1 to 5.");
  }
  if (typeof data.reviewedAt !== "string" || Number.isNaN(Date.parse(data.reviewedAt))) {
    errors.push("reviewedAt must be a parseable time.");
  }
  if (typeof data.staleAfterHours !== "number" || !(data.staleAfterHours > 0)) {
    errors.push("staleAfterHours must be a positive number.");
  }
  if (!data.scope || data.scope.weighting !== "national") {
    errors.push("scope.weighting must be national.");
  }
  if (!data.scope || typeof data.scope.geography !== "string" || !data.scope.geography.trim()) {
    errors.push("scope.geography is required.");
  }
  REQUIRED_TEXT.forEach((key) => {
    if (typeof data[key] !== "string" || !data[key].trim()) errors.push(key + " is required.");
  });
  if (!Array.isArray(data.evidence) || data.evidence.length === 0) {
    errors.push("evidence must be a non-empty array.");
  } else {
    const seen = new Set();
    data.evidence.forEach((item, i) => {
      const where = "evidence[" + i + "]";
      if (!item || typeof item !== "object") {
        errors.push(where + " must be an object.");
        return;
      }
      if (typeof item.id !== "string" || !item.id.trim() || seen.has(item.id)) {
        errors.push(where + ".id must be unique.");
      }
      seen.add(item.id);
      if (!STATUSES.includes(item.status)) errors.push(where + ".status is invalid.");
      if (typeof item.title !== "string" || !item.title.trim()) errors.push(where + ".title is required.");
      if (typeof item.summary !== "string" || !item.summary.trim()) errors.push(where + ".summary is required.");
      if (typeof item.factor !== "string" || !item.factor.trim()) errors.push(where + ".factor is required.");
      if (item.source != null) {
        if (!item.source || !safeHref(item.source.href) || safeHref(item.source.href).startsWith("/")) {
          errors.push(where + ".source.href must be an http(s) URL.");
        }
        if (typeof item.source.label !== "string" || !item.source.label.trim()) {
          errors.push(where + ".source.label is required.");
        }
      }
    });
  }
  if (!data.factors || !Array.isArray(data.factors.raise) || !data.factors.raise.length) {
    errors.push("factors.raise is required.");
  }
  if (!data.factors || !Array.isArray(data.factors.lower) || !data.factors.lower.length) {
    errors.push("factors.lower is required.");
  }
  if (!Array.isArray(data.levels) || data.levels.length !== 5) {
    errors.push("levels must contain 5 entries.");
  } else {
    [5, 4, 3, 2, 1].forEach((n) => {
      const row = data.levels.find((entry) => entry && entry.level === n);
      if (!row) {
        errors.push("levels missing " + n + ".");
        return;
      }
      ["name", "window", "means", "doesNotMean"].forEach((key) => {
        if (typeof row[key] !== "string" || !row[key].trim()) errors.push("level " + n + " " + key + " is required.");
      });
    });
  }
  if (!data.checklist || !Array.isArray(data.checklist.groups) || !data.checklist.groups.length) {
    errors.push("checklist.groups is required.");
  } else {
    data.checklist.groups.forEach((group, i) => {
      if (!group || typeof group.title !== "string" || !Array.isArray(group.items) || !group.items.length) {
        errors.push("checklist.groups[" + i + "] is incomplete.");
      }
    });
  }
  if (!Array.isArray(data.limitations) || !data.limitations.length) errors.push("limitations is required.");
  if (!Array.isArray(data.sources) || !data.sources.length) {
    errors.push("sources is required.");
  } else {
    data.sources.forEach((source, i) => {
      if (!source || !safeHref(source.href) || safeHref(source.href).startsWith("/")) {
        errors.push("sources[" + i + "] needs an http(s) href.");
      }
      if (!source || typeof source.label !== "string" || !source.label.trim()) {
        errors.push("sources[" + i + "].label is required.");
      }
    });
  }
  return { ok: errors.length === 0, errors };
}

export function formatReviewed(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const display = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
  return display.replace(/\bCST\b/, "CT").replace(/\bCDT\b/, "CT");
}

export function freshness(assessment, now) {
  const reviewedMs = Date.parse(assessment.reviewedAt);
  const windowMs = assessment.staleAfterHours * 60 * 60 * 1000;
  if (Number.isNaN(reviewedMs)) {
    return { stale: true, reason: "unparsed", ageMs: null, windowMs };
  }
  const ageMs = now - reviewedMs;
  if (ageMs < -5 * 60 * 1000) return { stale: true, reason: "future", ageMs, windowMs };
  if (ageMs > windowMs) return { stale: true, reason: "age", ageMs, windowMs };
  return { stale: false, reason: "fresh", ageMs, windowMs };
}

function levelRow(assessment) {
  if (!assessment || !Array.isArray(assessment.levels)) return null;
  return assessment.levels.find((row) => row && row.level === assessment.level) || null;
}

export function presentAssessment(assessment, options = {}) {
  const now = typeof options.now === "number" ? options.now : Date.now();
  const cached = options.cached && validateAssessment(options.cached).ok ? options.cached : null;
  const valid = assessment && validateAssessment(assessment).ok ? assessment : null;
  if (!valid && !cached) {
    return baseView({
      mode: "error",
      showLevel: false,
      warning:
        "The assessment file could not be loaded. No level is shown. This is not an all-clear and not an emergency signal.",
    });
  }
  const source = valid || cached;
  const fresh = freshness(source, now);
  const mode = valid ? (fresh.stale ? "stale" : "current") : "cached-error";
  const reviewedText = formatReviewed(source.reviewedAt);
  let warning = "";
  if (mode === "stale") {
    warning =
      fresh.reason === "age"
        ? "This assessment was reviewed " +
          reviewedText +
          ", which is past its " +
          source.staleAfterHours +
          "-hour review window. It is a saved snapshot, not a live feed."
        : "The reviewed timestamp is not a usable past time. Treat this as a saved snapshot, not a live feed.";
  } else if (mode === "cached-error") {
    warning =
      "The assessment file could not be refreshed. Showing the last copy saved in this browser, reviewed " +
      reviewedText +
      ". This is not a live reading.";
  }
  const row = levelRow(source);
  const publicSite = source.links && safeHref(source.links.publicSite);
  return baseView({
    mode,
    showLevel: true,
    level: source.level,
    levelName: row ? row.name : "",
    supplyWindow: source.supplyWindow,
    headline: source.headline,
    summary: source.summary,
    rationale: source.rationale,
    reviewedAt: source.reviewedAt,
    reviewedText,
    warning,
    scopeLabel: source.scope.geography,
    disclaimer: source.disclaimer,
    overrides: source.overrides,
    methodology: source.methodology,
    limitations: source.limitations.slice(),
    evidence: source.evidence.slice(),
    factors: { raise: source.factors.raise.slice(), lower: source.factors.lower.slice() },
    levels: source.levels.slice(),
    checklist: source.checklist,
    sources: source.sources.slice(),
    publicSite: publicSite && !publicSite.startsWith("/") ? publicSite : "",
    staleAfterHours: source.staleAfterHours,
  });
}

function baseView(partial) {
  return Object.assign(
    {
      mode: "error",
      showLevel: false,
      level: null,
      levelName: "",
      supplyWindow: "",
      headline: "",
      summary: "",
      rationale: "",
      reviewedAt: "",
      reviewedText: "",
      warning: "",
      scopeLabel: "",
      disclaimer: "",
      overrides: "",
      methodology: "",
      limitations: [],
      evidence: [],
      factors: { raise: [], lower: [] },
      levels: [],
      checklist: { intro: "", groups: [] },
      sources: [],
      publicSite: "",
      staleAfterHours: null,
    },
    partial
  );
}

/** Compact fields shared by the public page and the dashboard card. */
export function nationalFields(view) {
  return {
    mode: view.mode,
    showLevel: view.showLevel,
    level: view.showLevel ? String(view.level) : "",
    badge: view.showLevel ? "PANTRYCON " + view.level : "PANTRYCON",
    headline: view.showLevel ? view.headline : "National assessment unavailable",
    summary: view.showLevel ? view.summary : "",
    rationale: view.showLevel ? view.rationale : view.warning,
    reviewedAt: view.reviewedAt || "",
    reviewedText: view.reviewedText || "",
    sub: view.showLevel
      ? view.scopeLabel + " · Reviewed " + view.reviewedText
      : "United States households",
    warning: view.showLevel ? view.warning || "" : "",
    scopeLabel: view.scopeLabel || "",
    levelName: view.levelName || "",
    supplyWindow: view.supplyWindow || "",
  };
}

export function readCache(storage, key = CACHE_KEY) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const data = parsed && parsed.assessment ? parsed.assessment : parsed;
    return validateAssessment(data).ok ? data : null;
  } catch (err) {
    return null;
  }
}

export function writeCache(storage, assessment, key = CACHE_KEY) {
  if (!storage || typeof storage.setItem !== "function") return;
  if (!validateAssessment(assessment).ok) return;
  try {
    storage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), assessment }));
  } catch (err) {
    /* A full browser store should not block the page. */
  }
}

export async function loadSharedView({ fetchImpl, urls, storage, now, cacheKey }) {
  const key = cacheKey || CACHE_KEY;
  const cached = readCache(storage, key);
  let loaded = null;
  let failure = null;
  const list = Array.isArray(urls) ? urls : [];
  for (let i = 0; i < list.length; i += 1) {
    try {
      const response = await fetchImpl(list[i], { headers: { accept: "application/json" } });
      if (!response || !response.ok) {
        throw new Error("HTTP " + (response && response.status ? response.status : "error"));
      }
      const data = await response.json();
      const check = validateAssessment(data);
      if (!check.ok) throw new Error(check.errors.join(" "));
      loaded = data;
      failure = null;
      break;
    } catch (err) {
      failure = err instanceof Error ? err : new Error(String(err));
    }
  }
  if (loaded) writeCache(storage, loaded, key);
  return presentAssessment(loaded, { now, cached, error: failure });
}
