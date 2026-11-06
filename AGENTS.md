# AGENTS.md

Guardrails for any coding agent working in this repository. PANTRYCON is an independent, unofficial, U.S.-national household preparedness scale (5 calm to 1 critical). It is plain static HTML, CSS, JS, and JSON with no build step and no dependencies. Keep it that way.

## Read first

Before editing anything, read [`BAKE.md`](BAKE.md) (the maintenance and data contract) and [`schema.json`](schema.json). `README.md` has the local check and the Vercel import settings. `assess.mjs` holds the actual validator that the tests and both consumers rely on, and it is stricter than `schema.json` in places (for example unique evidence ids, `http(s)` source links, and all five level rows complete).

## `assessment.json` is the single source of truth

- It is the one canonical national assessment. The public site (`index.html`, `site.js`, `assess.mjs`) and the household dashboard (`SamSamskies/gm-dashboard`) both read it. Do not create a second copy of the level or its text anywhere, and do not hard-code a level in `index.html`.
- The dashboard fetches `https://raw.githubusercontent.com/SamSamskies/pantrycon/main/assessment.json` and keeps its own copy of the reader (`assess.mjs` is copied there as `pantrycon-reader.mjs`). Changing `assess.mjs` here does not update the dashboard. Do not edit the dashboard from this repository.

## Data contract

- `schemaVersion` is `1` and `instrument` is `PANTRYCON`. `level` is an integer 1 to 5. `scope.weighting` is `national`. `reviewedAt` is an ISO-8601 UTC time. `staleAfterHours` is currently 36.
- Do not casually rename, remove, retype, or repurpose any public field, evidence `status` value (`confirmed`, `developing`, `unverified`), or exported reader function (`validateAssessment`, `presentAssessment`, `nationalFields`, `loadSharedView`, `safeHref`, `readCache`, `writeCache`). Adding optional fields is the safe direction; `schema.json` allows additional properties.
- A contract change needs a new coordinated plan, not a drive-by edit: update `schema.json`, `assess.mjs`, `BAKE.md`, and `test/assess.test.mjs` together, keep the old shape readable, and document what the dashboard must change. Do not ship a change that makes the dashboard reject or misread the file on `main`.
- `links.publicSite` stays empty until a real deployment URL exists.

## Facts, freshness, and privacy

- Do not invent evidence, sources, quotes, thresholds, likelihoods, or incident history. If a category was not checked, leave it `unverified` and say so.
- Set `reviewedAt` only to the real time the sources were actually checked, even when the level does not change. Do not bump it to make a snapshot look fresh, and do not backdate or fake a stale reset.
- Design, copy, layout, and code work must not change assessment facts, the level, or `reviewedAt`. If a visual change seems to need different data, stop and ask.
- No personal inventory, name, home, travel notes, location, or secrets in `assessment.json` or the page. The level is national: do not weight it to one city or metro (including Austin). The tests scan public files for these.
- Do not present the site as live, official, DEFCON, government, or military. Level 1 "Full FORTRESS" is this project's own label. The page must keep showing no level, rather than a guessed one, when the file cannot be loaded.

## Current mechanisms

- Updates are made by editing `assessment.json` and committing it to `main`, as described in `BAKE.md`. This repository has no scheduled job or workflow that does that. Do not describe the daily review as automated.
- `og-image.png` is generated from `assessment.json` by `node scripts/og.mjs` (needs local Chrome). Never hand-edit it or the `?v=` stamp on `og:image` in `index.html`. After any change to `level` or `reviewedAt`, rerun the script and commit all three files; `node --test` fails if the image is out of date. The script is a local tool, not a build step.
- Vercel is configured through `vercel.json` (CORS for `/assessment.json`, `nosniff`, referrer policy) and the import settings in `README.md`: framework Other, blank build, install, and output commands, production branch `main`. Do not add a build or dependencies without a reason.

## Before you finish

Run `node --test` and fix what you broke. Note that the tests forbid a `%` character in `assessment.json` (write "percent"). Do not force-push, and do not delete `LICENSE`.
