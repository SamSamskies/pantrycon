import { SITE_URLS, loadSharedView, nationalFields, safeHref } from "./assess.mjs";

const STATUS_LABEL = {
  confirmed: "Confirmed",
  developing: "Developing",
  unverified: "Unverified",
};

export async function bootSite(doc, deps) {
  const root = doc;
  const fetchImpl = deps.fetchImpl;
  const storage = deps.storage;
  const now = deps.now;
  const view = await loadSharedView({
    fetchImpl,
    urls: SITE_URLS,
    storage,
    now,
  });
  paintSite(root, view);
  bindShare(root);
  return view;
}

export function paintSite(doc, view) {
  const fields = nationalFields(view);
  const root = doc.documentElement || doc.querySelector(":root") || doc;
  if (fields.showLevel && root && root.dataset) root.dataset.level = fields.level;
  else if (root && root.dataset) delete root.dataset.level;

  text(doc, "#disclaimer", view.disclaimer);
  text(doc, "#overrides", view.overrides);
  const state = doc.querySelector("#load-state");
  const hero = doc.querySelector("#hero");
  const rest = doc.querySelector("#details");
  if (!view.showLevel) {
    if (state) {
      state.hidden = false;
      state.textContent = view.warning;
    }
    if (hero) hero.hidden = true;
    if (rest) rest.hidden = true;
    return fields;
  }
  if (state) state.hidden = true;
  if (hero) hero.hidden = false;
  if (rest) rest.hidden = false;
  text(doc, "#level-kicker", "Level " + fields.level + " of 5");
  text(doc, "#level-num", fields.level);
  text(doc, "#level-name", view.levelName || fields.headline);
  const headline = doc.querySelector("#headline");
  if (headline) {
    const repeats = sameLabel(fields.headline, view.levelName);
    headline.textContent = repeats ? "" : fields.headline;
    headline.hidden = repeats || !fields.headline;
  }
  text(doc, "#summary", fields.summary);
  text(doc, "#scope", fields.scopeLabel);
  text(doc, "#window", view.supplyWindow);
  const reviewed = doc.querySelector("#reviewed");
  if (reviewed) {
    reviewed.textContent = view.reviewedText;
    reviewed.setAttribute("datetime", view.reviewedAt);
  }
  const warning = doc.querySelector("#warning");
  if (warning) {
    warning.hidden = !fields.warning;
    warning.textContent = fields.warning;
  }
  text(doc, "#rationale", view.rationale);
  renderScale(doc.querySelector("#scale"), view);
  renderEvidence(doc.querySelector("#evidence"), view.evidence);
  renderPlainList(doc.querySelector("#raise"), view.factors.raise);
  renderPlainList(doc.querySelector("#lower"), view.factors.lower);
  renderLevels(doc.querySelector("#levels"), view);
  text(doc, "#check-intro", view.checklist && view.checklist.intro ? view.checklist.intro : "");
  renderChecklist(doc.querySelector("#checklist"), view.checklist);
  text(doc, "#methodology", view.methodology);
  renderPlainList(doc.querySelector("#limitations"), view.limitations);
  renderSources(doc.querySelector("#sources"), view.sources);
  return fields;
}

function sameLabel(a, b) {
  const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) !== "" && norm(a) === norm(b);
}

function formatAsOf(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const ms = Date.parse(value + "T12:00:00Z");
  if (Number.isNaN(ms)) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

function text(doc, selector, value) {
  const node = doc.querySelector(selector);
  if (node) node.textContent = value || "";
}

function clear(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderScale(list, view) {
  clear(list);
  if (!list) return;
  const levels = view.levels.slice().sort((a, b) => b.level - a.level);
  levels.forEach((row) => {
    const doc = list.ownerDocument;
    const item = doc.createElement("li");
    item.className = "lv lv-" + row.level;
    const current = row.level === view.level;
    if (current) item.setAttribute("aria-current", "true");
    const flag = doc.createElement("span");
    flag.className = "scale-flag";
    flag.textContent = current ? "Current" : "";
    const bar = doc.createElement("span");
    bar.className = "scale-bar";
    bar.setAttribute("aria-hidden", "true");
    const num = doc.createElement("span");
    num.className = "scale-num";
    num.textContent = String(row.level);
    const windowText = doc.createElement("span");
    windowText.className = "scale-window";
    windowText.textContent = row.window;
    const label = doc.createElement("span");
    label.className = "sr-only";
    label.textContent = "Level " + row.level + ", " + row.name + ", " + row.window + (current ? ", current level" : "");
    item.append(flag, bar, num, windowText, label);
    list.append(item);
  });
}

function renderEvidence(list, evidence) {
  clear(list);
  if (!list) return;
  evidence.forEach((item) => {
    const card = list.ownerDocument.createElement("li");
    const top = list.ownerDocument.createElement("p");
    top.className = "evidence-top";
    const status = list.ownerDocument.createElement("span");
    status.className = "status status-" + item.status;
    status.textContent = STATUS_LABEL[item.status] || item.status;
    const factor = list.ownerDocument.createElement("span");
    factor.className = "factor";
    factor.textContent = item.factor;
    top.append(status, factor);
    const title = list.ownerDocument.createElement("h3");
    title.textContent = item.title;
    const summary = list.ownerDocument.createElement("p");
    summary.textContent = item.summary;
    card.className = "ev ev-" + item.status;
    card.append(top, title, summary);
    if (item.limits) {
      const limits = list.ownerDocument.createElement("p");
      limits.className = "limits";
      limits.textContent = item.limits;
      card.append(limits);
    }
    const href = item.source && safeHref(item.source.href);
    if (href && !href.startsWith("/")) {
      const foot = list.ownerDocument.createElement("p");
      foot.className = "ev-source";
      const link = list.ownerDocument.createElement("a");
      link.href = href;
      link.textContent = item.source.label;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      foot.append(link);
      const asOf = formatAsOf(item.source.asOf);
      if (asOf) {
        const when = list.ownerDocument.createElement("span");
        when.textContent = "Data as of " + asOf;
        foot.append(when);
      }
      card.append(foot);
    }
    list.append(card);
  });
}

function renderPlainList(list, items) {
  clear(list);
  if (!list) return;
  (items || []).forEach((item) => {
    const li = list.ownerDocument.createElement("li");
    li.textContent = item;
    list.append(li);
  });
}

function renderLevels(list, view) {
  clear(list);
  if (!list) return;
  const levels = view.levels.slice().sort((a, b) => b.level - a.level);
  levels.forEach((row) => {
    const doc = list.ownerDocument;
    const item = doc.createElement("li");
    item.className = "lv lv-" + row.level;
    if (row.level === view.level) item.setAttribute("aria-current", "true");
    const badge = doc.createElement("span");
    badge.className = "row-num";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = String(row.level);
    const head = doc.createElement("div");
    head.className = "row-head";
    const title = doc.createElement("h3");
    title.textContent = "PANTRYCON " + row.level + " · " + row.name;
    const windowText = doc.createElement("p");
    windowText.className = "window";
    windowText.textContent = row.window + (row.level === view.level ? " · Current level" : "");
    head.append(title, windowText);
    const body = doc.createElement("div");
    body.className = "row-body";
    const means = doc.createElement("p");
    means.textContent = row.means;
    const not = doc.createElement("p");
    not.className = "limits";
    not.textContent = row.doesNotMean;
    body.append(means, not);
    item.append(badge, head, body);
    list.append(item);
  });
}

function renderChecklist(list, checklist) {
  clear(list);
  if (!list || !checklist) return;
  checklist.groups.forEach((group) => {
    const item = list.ownerDocument.createElement("li");
    const title = list.ownerDocument.createElement("h3");
    title.textContent = group.title;
    const bits = list.ownerDocument.createElement("ul");
    group.items.forEach((entry) => {
      const li = list.ownerDocument.createElement("li");
      li.textContent = entry;
      bits.append(li);
    });
    item.append(title, bits);
    list.append(item);
  });
}

function renderSources(list, sources) {
  clear(list);
  if (!list) return;
  sources.forEach((source) => {
    const href = safeHref(source.href);
    if (!href || href.startsWith("/")) return;
    const item = list.ownerDocument.createElement("li");
    const link = list.ownerDocument.createElement("a");
    link.href = href;
    link.textContent = source.label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const used = list.ownerDocument.createElement("span");
    used.textContent = source.usedFor || "";
    item.append(link, used);
    list.append(item);
  });
}

function bindShare(doc) {
  if (doc.__pantryconShareBound) return;
  doc.__pantryconShareBound = true;
  const share = doc.querySelector("#share");
  const url = doc.location && doc.location.href ? doc.location.href : "";
  if (share && doc.defaultView && doc.defaultView.navigator && doc.defaultView.navigator.share) {
    share.hidden = false;
    share.addEventListener("click", function () {
      doc.defaultView.navigator
        .share({
          title: "PANTRYCON",
          text: "Unofficial U.S. household preparedness assessment. Not a government or military alert.",
          url: url,
        })
        .catch(function () {});
    });
  }
}

if (typeof document !== "undefined") {
  bootSite(document, {
    fetchImpl: fetch,
    storage: window.localStorage,
    now: Date.now(),
  }).catch(function () {});
}
