# Daily PANTRYCON review

This file is the maintenance contract. The public page and the household dashboard both read one JSON object. There is no second national level.

## What to edit

Edit only [`assessment.json`](assessment.json) in this repository. Set `reviewedAt` to the actual review time in UTC, even when the level does not change. If `reviewedAt` is older than `staleAfterHours` (36), both surfaces mark the snapshot stale and keep showing the last reviewed level.

Before committing:

```bash
node --test
```

Push to `main`. Do not force-push. The household dashboard fetches:

`https://raw.githubusercontent.com/SamSamskies/pantrycon/main/assessment.json`

That URL is the public read until a deployment URL is written into `links.publicSite`.

## Data contract

`schemaVersion` is `1`. `instrument` is `PANTRYCON`. `scope.weighting` is `national`. `scope.geography` describes U.S. households, not one city.

| Field | Role |
| --- | --- |
| `level` | Integer 5 (calm) through 1 (critical). |
| `reviewedAt` | ISO-8601 UTC time the sources were actually checked. |
| `staleAfterHours` | Age after which the snapshot must warn. Current value: 36. |
| `headline`, `summary`, `rationale`, `supplyWindow` | What both surfaces show. |
| `evidence[]` | Each item has `status`: `confirmed`, `developing`, or `unverified`. |
| `factors.raise`, `factors.lower` | Qualitative changes that would move the level. Not fake numeric triggers. |
| `levels` | All five bands, including `means` and `doesNotMean`. |
| `checklist` | Food, water, prescriptions, power, cash, communications, access. |
| `overrides` | Local official alerts always win. |
| `links.publicSite` | Empty until the Vercel URL exists. Then the `https://` origin of this site. |

`confirmed` means the linked page states the fact. `developing` means the record is incomplete. `unverified` means this review did not confirm it. Do not invent official thresholds, likelihoods, quotes, or incident history. If a category cannot be checked, leave it `unverified` and say that.

Level durations stay aligned with the household board: 5 is 3–7 days, 4 is about 2 weeks, 3 is about 30 days, 2 is about 60 days, 1 is 90 days or more. Those are this project's labels. Level 1's name, Full FORTRESS, is not a Pentagon or DEFCON status.

## Privacy

Do not put a person's name, pantry inventory, home, travel notes, or secrets in `assessment.json` or the page. Do not weight the national level to one metro area. The morning board may keep its own local note; that note is not this file.

## Household dashboard

The board repository should keep this tag before `</body>`:

```html
<script type="module" src="/pantrycon-sync.js"></script>
```

`patch.py` has to preserve that tag and `/pantrycon-sync.js` plus `/pantrycon-reader.mjs`. The baked `cards.json` `"pantry"` object stays local context. The script draws the national card above it and does not replace the local card. If the fetch fails, the national card says so and does not invent a level; a copy saved in the browser, when one exists, is shown with its reviewed time.

On the next local bake, drop any line that calls level 1 a Pentagon standard. This project does not use that claim.

## Vercel import

Framework Other. Root directory blank. Build, output, and install commands empty. Production branch `main`. No environment variables. Do not create or change any other Vercel project from this repo's tooling.
