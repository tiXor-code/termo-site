<!-- SEC-RULES v1 START -->
**Security gate.** Every change made in this workspace must comply with the Secure Development Rules Reference: `~/aios/security/rules/secure-development-rules-reference.md` (index: `~/aios/security/rules/RULES-INDEX.md`). Before completing any task, check the work against those rules and flag every breach with its SEC ID and severity. CRITICAL breaches block completion -- fix or escalate before proceeding. For security-relevant changes (auth, secrets, input handling, dependencies, agent/MCP/hook/skill config), read the matching rule section first.
<!-- SEC-RULES v1 END -->

# termo-site

[faraapacalda.ro](https://faraapacalda.ro) — Next 16 App Router, TypeScript strict,
Tailwind v4, **pure SSG** (~2,353 static pages). Consumes the `data-latest` bundle
published by `tiXor-code/termo-data`; that repo's `ARTIFACTS.md` is the contract.

## Build and test

```bash
node scripts/fetch-data.mjs     # required first: downloads + extracts the bundle into .data/
npm test                        # vitest, fixtures in test/fixtures/data
npm run build
npx playwright test             # needs .data/ populated AND a production build
```

`DATA_BUNDLE_PATH=/abs/path/bundle.tar.gz node scripts/fetch-data.mjs` builds against a
local bundle instead of the published release. That is the way to develop against a
bundle the nightly has not published yet.

**A server already on :3000 makes Playwright test stale code.** `reuseExistingServer` is
on outside CI, so if anything is serving :3000 the webServer step is skipped and no
rebuild happens — the suite silently runs against whatever was built last, including a
different `NEXT_PUBLIC_*` inlining. A suite that finishes suspiciously fast (no build) is
the tell. Free the port first: `kill $(lsof -ti:3000)`.

## Pure SSG is a constraint, not a preference

Pages use `export const dynamic = 'error'` plus `generateStaticParams`. Data is read at
**build time** through `lib/data.ts`, so a missing bundle field is a build failure, not
a runtime one. Do not add client components to the render path.

## The headline metric

The big number on every page is `days` = calendar days with a hot-water **stoppage**
(`oprire`, ACC). CMTEB also publishes `Deficiență` — pressure or temperature below spec
— counted separately as `days_deficienta`. **Never sum the two.** The union of
non-`deficienta` runs equals `days` for every entity-year; `lib/strip.ts` depends on it.

## Deploy order (twice-bitten)

Pushing `main` auto-deploys production against the **current** `data-latest`. Site code
that reads a newly added bundle field renders as if the field were absent until the
nightly uploads a new bundle and the deploy hook fires a second build.

Do not use the search-index hash as the deploy signal — it is stable across nightlies.
Use the Dataset JSON-LD `dateModified` on `/metodologie`, which equals the bundle's
`meta.generated_at` to the minute:

```bash
BUNDLE=https://github.com/tiXor-code/termo-data/releases/download/data-latest/bundle.tar.gz
published() { curl -sSL "$BUNDLE" | tar -xzO ./meta.json \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['generated_at'])"; }
live() { curl -sS https://faraapacalda.ro/metodologie \
  | grep -o '"dateModified":"[^"]*"' | head -1 | cut -d'"' -f4; }
[ "$(published)" = "$(live)" ] && echo "LIVE ON CURRENT BUNDLE" || echo "SITE IS BEHIND"
```

Write reads of any recently added bundle field defensively, so an older bundle degrades
to a hidden section rather than `NaN`. `app/strada/[slug]/page.tsx` carries the
established idiom under the comment `Deploy-order safety`.

## Conventions

- Romanian copy, proper diacritics.
- Rendered HTML splits text around interpolated values with `<!-- -->`. Assertions on
  rendered output must not span an interpolation boundary.
- **All JSON-LD must go through `JsonLd` in `lib/seo.ts`.** It writes into
  `dangerouslySetInnerHTML`, so it escapes `<` as `\u003c` before
  emitting. That escaping is load-bearing, not cosmetic: PT and street names come from
  scraped CMTEB announcements and are untrusted input, and they reach JSON-LD via
  `breadcrumbJsonLd` (see `app/strada/[slug]/page.tsx`). Without it, a name containing
  `</script>` closes the tag early and injects markup. Never hand-build a
  `<script type="application/ld+json">` payload around scraped text, and never remove
  the `.replace()` in `JsonLd`.
- `.claude/artifacts/` holds local screenshot output and stays out of git.
