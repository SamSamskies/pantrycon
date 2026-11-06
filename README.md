# PANTRYCON

An unofficial household preparedness assessment for the United States. The scale runs from **5 (calm)** to **1 (critical)**. It is not a government alert, not DEFCON, and not a statement that every place faces the same immediate threat.

The canonical snapshot is [`assessment.json`](assessment.json). The page reads that file. It does not invent a level when the file cannot be loaded.

## Local check

```bash
node --test
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/`. Fetching `assessment.json` from `file://` will fail, so use a local server.

## Vercel

Import this repository after the site is on `main`. No environment variables.

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Root directory | repository root (leave blank) |
| Build command | empty |
| Output directory | empty |
| Install command | empty |
| Production branch | `main` |

The site is static. `index.html` is the page. `/assessment.json` is the public read of the same snapshot, with CORS enabled in `vercel.json`.

After the deployment URL exists, set `links.publicSite` in `assessment.json` to that `https://` origin so the household dashboard can link to this page.

## Maintaining the level

Update instructions for the daily review live in [`BAKE.md`](BAKE.md). Change the level by editing `assessment.json` and committing it. Do not bake a second copy into another project.
