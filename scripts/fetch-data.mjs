#!/usr/bin/env node
/**
 * fetch-data.mjs — acquires the termo-data bundle, extracts it to .data/,
 * validates the artifact contract, and republishes client assets into
 * public/data/ with content-hashed filenames (manifest at .data/client-manifest.json).
 *
 * Plain Node, no dependencies. Runs as `prebuild` / `predev`.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, '.data');
const PUBLIC_DATA_DIR = path.join(ROOT, 'public', 'data');
const RELEASE_URL =
  'https://github.com/tiXor-code/termo-data/releases/download/data-latest/bundle.tar.gz';

function fail(msg) {
  console.error(`[fetch-data] FATAL: ${msg}`);
  process.exit(1);
}

// 1. Skip when explicitly told to and data already exists.
if (
  process.env.SKIP_DATA_FETCH === '1' &&
  fs.existsSync(path.join(DATA_DIR, 'meta.json'))
) {
  console.log('[fetch-data] SKIP_DATA_FETCH=1 and .data/meta.json exists — skipping.');
  process.exit(0);
}

// 2. Acquire the tarball.
async function download(url, dest) {
  const MAX_TRIES = 3;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      return;
    } catch (err) {
      if (attempt === MAX_TRIES) {
        fail(`download failed after ${MAX_TRIES} attempts: ${err.message}`);
      }
      const waitMs = 1000 * 2 ** (attempt - 1);
      console.warn(
        `[fetch-data] attempt ${attempt} failed (${err.message}); retrying in ${waitMs}ms`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

let tarball;
if (process.env.DATA_BUNDLE_PATH) {
  tarball = path.resolve(process.env.DATA_BUNDLE_PATH);
  if (!fs.existsSync(tarball)) {
    fail(`DATA_BUNDLE_PATH points to a missing file: ${tarball}`);
  }
  console.log(`[fetch-data] using local bundle: ${tarball}`);
} else {
  tarball = path.join(os.tmpdir(), `termo-bundle-${process.pid}.tar.gz`);
  console.log(`[fetch-data] downloading ${RELEASE_URL}`);
  await download(RELEASE_URL, tarball);
}

// 3. Extract.
fs.rmSync(DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
const tar = spawnSync('tar', ['-xzf', tarball, '-C', DATA_DIR], { stdio: 'inherit' });
if (tar.status !== 0) {
  fail(`tar extraction failed with status ${tar.status}`);
}

// 4. Validate the contract.
const metaPath = path.join(DATA_DIR, 'meta.json');
if (!fs.existsSync(metaPath)) fail('bundle is missing meta.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const years = meta.years;
if (!Array.isArray(years) || years.length === 0) fail('meta.json has no years[]');

const dataThroughYear = Number(String(meta.data_through).slice(0, 4));
const nonFutureYears = years.filter((y) => y <= dataThroughYear);

const required = ['meta.json', 'city/summary.json', 'pt/all.ndjson.gz', 'strazi/all.ndjson.gz', 'client/search-index.json', 'og/stats.json'];
for (const y of years) {
  required.push(`city/distribution-${y}.json`);
  required.push(`rankings/pt-${y}.json`);
  required.push(`rankings/strazi-${y}.json`);
  required.push(`rankings/sectoare-${y}.json`);
}
for (const y of nonFutureYears) {
  required.push(`client/map/pt-${y}.geojson`);
}

const missing = required.filter((rel) => !fs.existsSync(path.join(DATA_DIR, rel)));
if (missing.length > 0) {
  console.error('[fetch-data] bundle is missing required artifacts:');
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

const hasSectoareGeo = fs.existsSync(path.join(DATA_DIR, 'client/sectoare.geojson'));
if (!hasSectoareGeo) {
  console.warn(
    '[fetch-data] WARN: client/sectoare.geojson absent — sector silhouettes will be omitted (site degrades gracefully).',
  );
}

// 5. Republish client assets with content-hashed filenames + manifest.
fs.rmSync(PUBLIC_DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });

function hashOf(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
}

const manifest = {};

/** Copy `.data/<srcRel>` to `public/data/<destRel with .<hash> before ext>`; record under manifestKey. */
function publish(srcRel, destRel, manifestKey) {
  const src = path.join(DATA_DIR, srcRel);
  const h = hashOf(src);
  const ext = path.extname(destRel);
  const hashedRel = `${destRel.slice(0, -ext.length)}.${h}${ext}`;
  const dest = path.join(PUBLIC_DATA_DIR, hashedRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  manifest[manifestKey] = `/data/${hashedRel}`;
}

publish('client/search-index.json', 'search-index.json', 'search-index.json');
for (const y of nonFutureYears) {
  publish(`client/map/pt-${y}.geojson`, `map/pt-${y}.geojson`, `map/pt-${y}.geojson`);
}
for (const y of years) {
  publish(
    `rankings/strazi-${y}.json`,
    `rankings/strazi-${y}.json`,
    `rankings/strazi-${y}.json`,
  );
}
if (hasSectoareGeo) {
  publish('client/sectoare.geojson', 'sectoare.geojson', 'sectoare.geojson');
} else {
  manifest['sectoare.geojson'] = null;
}

fs.writeFileSync(
  path.join(DATA_DIR, 'client-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);

// 6. Summary.
console.log('[fetch-data] OK');
console.log(`  years:         ${years.join(', ')}`);
console.log(`  universe_size: ${meta.universe_size}`);
console.log(`  data_through:  ${meta.data_through}`);
console.log(`  client assets: ${Object.keys(manifest).length} manifest entries`);
