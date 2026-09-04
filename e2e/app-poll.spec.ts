import { expect, test, type Page } from "@playwright/test";

import { POLL_DELAY_MS } from "../playwright.config";
import { singlePtStreet, topPt } from "./helpers";

// The route needs Supabase envs that exist only on Vercel, so every spec
// intercepts /api/app-poll - we test the dialog, not Supabase.
const STREET = singlePtStreet();
const PT = topPt();

function intercept(page: Page, posts: string[] = []) {
  return page.route("**/api/app-poll", (route) => {
    if (route.request().method() === "POST") posts.push(route.request().postData() ?? "");
    return route.fulfill({ status: 204 });
  });
}

// The dialog is deliberately delayed so it never behaves as an on-arrival
// interstitial. Fake the clock and jump past the (test-inflated) delay rather
// than waiting on it.
async function openPoll(page: Page, path: string) {
  await page.clock.install();
  await page.goto(path);
  await page.clock.fastForward(POLL_DELAY_MS + 1_000);
  const dialog = page.getByRole("dialog", { name: "Întrebare despre o aplicație" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("does not appear on arrival, only after the delay", async ({ page }) => {
  await intercept(page);
  await page.clock.install();
  await page.goto(`/strada/${STREET.slug}`);
  await page.clock.fastForward(POLL_DELAY_MS - 1_000);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.clock.fastForward(2_000);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("Da then platform: records both steps against one nonce, then thanks", async ({ page }) => {
  const posts: string[] = [];
  await intercept(page, posts);
  const dialog = await openPoll(page, `/strada/${STREET.slug}`);

  await expect(dialog.getByText("Te-ar interesa o aplicație pentru faraapacalda.ro?")).toBeVisible();
  await dialog.getByRole("button", { name: "Da", exact: true }).click();

  await expect(dialog.getByText("Preferi pe:")).toBeVisible();
  await dialog.getByRole("button", { name: "Android" }).click();
  await expect(dialog.getByText(/Mulțumesc mult!/)).toBeVisible();

  expect(posts).toHaveLength(2);
  const first = JSON.parse(posts[0]);
  const second = JSON.parse(posts[1]);
  expect(first).toMatchObject({ interested: true, website: "" });
  expect(first.platform).toBeUndefined();
  expect(second).toMatchObject({ interested: true, platform: "android" });
  // Both steps must land on the SAME row, or the platform answer is orphaned.
  expect(second.nonce).toBe(first.nonce);
  expect(first.page).toBe(`/strada/${STREET.slug}`);
});

test("Nu records a single answer and never asks a platform", async ({ page }) => {
  const posts: string[] = [];
  await intercept(page, posts);
  const dialog = await openPoll(page, `/punct-termic/${PT.slug}`);

  await dialog.getByRole("button", { name: "Nu", exact: true }).click();
  await expect(dialog.getByText(/Mulțumesc mult!/)).toBeVisible();
  await expect(dialog.getByText("Preferi pe:")).toHaveCount(0);

  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0])).toMatchObject({ interested: false });
});

test("closing with × suppresses it on reload, and records nothing", async ({ page }) => {
  const posts: string[] = [];
  await intercept(page, posts);
  const dialog = await openPoll(page, `/strada/${STREET.slug}`);

  await dialog.getByRole("button", { name: "Închide" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(posts).toHaveLength(0);

  await page.clock.install();
  await page.reload();
  await page.clock.fastForward(POLL_DELAY_MS + 1_000);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("tapping Da still counts if the dialog is closed before picking a platform", async ({
  page,
}) => {
  const posts: string[] = [];
  await intercept(page, posts);
  const dialog = await openPoll(page, `/strada/${STREET.slug}`);

  await dialog.getByRole("button", { name: "Da", exact: true }).click();
  await dialog.getByRole("button", { name: "Închide" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0])).toMatchObject({ interested: true });
});

test("only one ask on screen: the feedback pill hides while the dialog is open", async ({
  page,
}) => {
  await intercept(page);
  await page.route("**/api/feedback", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ up: 0 }) }),
  );
  await page.clock.install();
  await page.goto(`/strada/${STREET.slug}`);
  const pill = page.getByRole("region", { name: "Feedback despre site" });
  await expect(pill).toBeVisible();

  await page.clock.fastForward(POLL_DELAY_MS + 1_000);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(pill).toBeHidden();
});

test("never fires on pages that are not an answer page", async ({ page }) => {
  await intercept(page);
  for (const path of ["/", "/clasament", "/metodologie"]) {
    await page.clock.install();
    await page.goto(path);
    await page.clock.fastForward(POLL_DELAY_MS + 1_000);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("Escape closes the dialog", async ({ page }) => {
  await intercept(page);
  await openPoll(page, `/strada/${STREET.slug}`);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

// Regression: the key handler used to be bound to the backdrop element, so
// clicking the backdrop moved focus to <body> and Escape silently stopped
// working - leaving the × as the only way out of a dialog that locks scroll.
test("Escape still closes after a backdrop click moves focus away", async ({ page }) => {
  await intercept(page);
  await openPoll(page, `/strada/${STREET.slug}`);

  await page.mouse.click(5, 5); // backdrop, well clear of the centred dialog
  await expect(page.getByRole("dialog")).toBeVisible(); // backdrop click must NOT dismiss
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
