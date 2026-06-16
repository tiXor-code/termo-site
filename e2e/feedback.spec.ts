import { expect, test } from "@playwright/test";

// The API route needs Supabase envs that exist only on Vercel, so every spec
// intercepts /api/feedback - we test the widget, not Supabase. GET returns the
// positive-vote tally (default 0 = no badge); POST (a vote) fulfills 204.
function intercept(page: import("@playwright/test").Page, up = 0) {
  return page.route("**/api/feedback", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ up }),
      });
    }
    return route.fulfill({ status: 204 });
  });
}

test("up-vote: thanks, then suppressed after reload", async ({ page }) => {
  await intercept(page);
  await page.goto("/");
  const region = page.getByRole("region", { name: "Feedback despre site" });
  await expect(region).toBeVisible();
  await region.getByRole("button", { name: "Da, mi-a fost util" }).click();
  await expect(region.getByText("Mulțumim!")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Feedback despre site" })).toHaveCount(0);
});

test("up button shows the running positive-vote tally as a badge", async ({ page }) => {
  await intercept(page, 61);
  await page.goto("/");
  const region = page.getByRole("region", { name: "Feedback despre site" });
  await expect(region.getByRole("button", { name: "Da, mi-a fost util" })).toContainText("61");
});

test("down-vote: textarea expands, message submits", async ({ page }) => {
  await intercept(page);
  const posts: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/feedback") && req.method() === "POST") {
      posts.push(req.postData() ?? "");
    }
  });
  await page.goto("/clasament");
  const region = page.getByRole("region", { name: "Feedback despre site" });
  await region.getByRole("button", { name: "Nu, am întâmpinat probleme" }).click();
  const box = region.getByLabel("Ce nu a mers sau ce ai fi vrut să găsești?");
  await expect(box).toBeFocused();
  await box.fill("test feedback e2e");
  await region.getByRole("button", { name: "Trimite" }).click();
  await expect(region.getByText("Mulțumim!")).toBeVisible();
  expect(posts).toHaveLength(1);
  const body = JSON.parse(posts[0]);
  expect(body).toMatchObject({ vote: "down", message: "test feedback e2e", website: "" });
  expect(body.page).toBe("/clasament");
});

test("dismiss hides without voting; absent on /harta", async ({ page }) => {
  await intercept(page);
  await page.goto("/despre");
  const region = page.getByRole("region", { name: "Feedback despre site" });
  await region.getByRole("button", { name: "Închide" }).click();
  await expect(region).toHaveCount(0);
  await page.goto("/harta");
  await expect(page.getByRole("region", { name: "Feedback despre site" })).toHaveCount(0);
});
