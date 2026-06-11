import { expect, test } from '@playwright/test';
import { lcy, topPt, topStreet } from './helpers';

const YEAR = lcy();
const TOP_PT = topPt();
const TOP_STREET = topStreet();

test('punct termic detail: days, outage strip, breadcrumb JSON-LD', async ({ page }) => {
  await page.goto(`/punct-termic/${TOP_PT.slug}`);
  await expect(page.locator('h1')).toHaveText(TOP_PT.name);
  await expect(page.locator('main')).toContainText(String(TOP_PT.days));
  expect(await page.locator('main svg').count()).toBeGreaterThan(0);
  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(jsonLd.some((s) => s.includes('BreadcrumbList'))).toBe(true);
});

test('strada detail: caveat and per-PT breakdown', async ({ page }) => {
  await page.goto(`/strada/${TOP_STREET.slug}`);
  await expect(page.locator('main')).toContainText('la nivel de punct termic');
  await expect(page.locator('main')).toContainText(String(TOP_STREET.days));
  const ptLinks = page.locator('table a[href^="/punct-termic/"]');
  expect(await ptLinks.count()).toBeGreaterThanOrEqual(1);
});

test('metodologie: episode heading, Jaccard, Dataset JSON-LD', async ({ page }) => {
  await page.goto('/metodologie');
  await expect(
    page.getByRole('heading', { name: 'Cum reconstruim episoadele' }),
  ).toBeVisible();
  await expect(page.locator('main')).toContainText('Jaccard');
  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(jsonLd.some((s) => s.includes('"Dataset"'))).toBe(true);
});

test('og route: 200 png for top slug, 404 for unknown', async ({ request }) => {
  const ok = await request.get(`/og/${TOP_PT.slug}`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()['content-type']).toContain('image/png');

  const missing = await request.get('/og/nu-exista-xyz');
  expect(missing.status()).toBe(404);
});

test('sitemap.xml lists detail pages', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('/strada/');
  expect(body).toContain('/punct-termic/');
});

test('unknown PT slug: 404 page with search box', async ({ page }) => {
  const response = await page.goto('/punct-termic/slug-inexistent');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('combobox').first()).toBeVisible();
});

test(`sanity: yearless clasament shows ${YEAR} context`, async ({ page }) => {
  await page.goto(`/clasament/strazi`);
  await expect(page.locator('h1')).toContainText(String(YEAR));
});
