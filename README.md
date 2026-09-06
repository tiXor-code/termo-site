# termo-site

**[faraapacalda.ro](https://faraapacalda.ro)** answers one question for every street,
heating point and sector in Bucharest: how many days a year does this place go without hot
water? (RO: *cate zile pe an sta Bucurestiul fara apa calda*.)

The city's heating utility publishes current outages and deletes them once resolved. No
official archive exists. [`termo-data`](https://github.com/tiXor-code/termo-data) snapshots
the public pages every 15 minutes and publishes a nightly `data-latest` bundle; this repo
turns that bundle into a fully static site of ~2,350 pages.

Live: <https://faraapacalda.ro>

## What it is

- **Next 16 App Router, TypeScript strict, Tailwind v4, pure SSG.** Every page sets
  `dynamic = 'error'` and uses `generateStaticParams`. Data is read at build time through
  `lib/data.ts`, so a missing bundle field fails the build instead of rendering `NaN`.
- **Entity pages:** `/strada/[slug]` (street), `/punct-termic/[slug]` (heating point),
  `/sector/[id]`, plus `/clasament` rankings, `/harta` map, `/cauta` search, and
  `/metodologie` with a Dataset JSON-LD that carries the bundle timestamp.
- **Block finder:** a street page resolves a block number to the heating point serving it,
  with the current outage status per sector.
- **Feedback + app-demand poll:** two tiny API routes writing to Supabase, the only
  non-static surface.
- **AI-readable:** `/llms.txt` and per-page OG images.

## The headline metric

The big number is `days`: calendar days with a hot-water **stoppage** (`oprire`). The
utility also publishes *deficienta* (pressure or temperature below spec); that is counted
separately as `days_deficienta` and shown site-wide, but never summed with `days`. The
distinction is what makes the number defensible.

## Build and test

```bash
node scripts/fetch-data.mjs   # downloads + extracts the published bundle into .data/
npm test                      # vitest, 122 tests on fixtures in test/fixtures/data
npm run build
npx playwright test           # e2e, needs .data/ populated and a production build
```

`DATA_BUNDLE_PATH=/abs/path/bundle.tar.gz node scripts/fetch-data.mjs` builds against a
local bundle, which is how site code gets developed against data the nightly has not
published yet.

## Things that bit

- **Deploy order.** Pushing `main` deploys against the *current* bundle. Code that reads a
  newly added field renders as if it were absent until the next nightly triggers a second
  build, so reads of new fields degrade to a hidden section, not a broken page. The deploy
  signal is the `dateModified` on `/metodologie`, which equals the bundle's
  `generated_at` to the minute.
- **Scraped names are untrusted input.** Street and heating-point names come from the
  utility's announcements and reach JSON-LD via breadcrumbs. Every JSON-LD payload goes
  through one helper that escapes `<` before `dangerouslySetInnerHTML`; without it a name
  containing `</script>` would close the tag early.
- **A stray server on :3000 makes Playwright test stale code** (`reuseExistingServer`).
  A suite that finishes suspiciously fast is the tell.

## Data and credits

Data reproduces public information published by CMTEB / Termoenergetica SA on cmteb.ro.
Sector boundaries derive from OpenStreetMap ((c) OpenStreetMap contributors, ODbL). The
git-scraping model follows [FlorinPopaCodes/termoficare-data](https://github.com/FlorinPopaCodes/termoficare-data)
and [gov2-ro/prometeu](https://github.com/gov2-ro/prometeu).
