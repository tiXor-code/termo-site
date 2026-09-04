// Pure validation for the app-interest poll - kept dependency-free so vitest can
// exercise it without the route handler's runtime. Mirrors lib/feedback.ts.
//
// The poll is answered in two steps (interest, then platform) and both steps
// write the same row, keyed on a client-generated nonce. Whoever holds the
// nonce can amend that row, so the nonce is required to look like a UUID: it
// keeps enumeration out of reach and bounds what reaches the unique index.

export interface AppPollInput {
  nonce?: unknown;
  interested?: unknown;
  platform?: unknown;
  page?: unknown;
  website?: unknown; // honeypot: humans never fill it
}

export type Platform = "android" | "ios";

export interface AppPollRecord {
  nonce: string;
  interested: boolean;
  platform: Platform | null;
  page: string | null;
}

export type AppPollResult =
  | { ok: true; record: AppPollRecord }
  | { ok: false; reason: "honeypot" | "invalid" };

const MAX_PAGE = 200;
const PLATFORMS: readonly string[] = ["android", "ios"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validateAppPoll(body: AppPollInput): AppPollResult {
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return { ok: false, reason: "honeypot" };
  }

  if (typeof body.nonce !== "string") return { ok: false, reason: "invalid" };
  const nonce = body.nonce.trim().toLowerCase();
  if (!UUID_RE.test(nonce)) return { ok: false, reason: "invalid" };

  if (typeof body.interested !== "boolean") return { ok: false, reason: "invalid" };

  let platform: Platform | null = null;
  if (body.platform !== undefined && body.platform !== null) {
    if (typeof body.platform !== "string" || !PLATFORMS.includes(body.platform)) {
      return { ok: false, reason: "invalid" };
    }
    // Same rule as the fac_app_poll_platform_implies_interest CHECK constraint.
    if (!body.interested) return { ok: false, reason: "invalid" };
    platform = body.platform as Platform;
  }

  let page: string | null = null;
  if (typeof body.page === "string" && body.page.startsWith("/")) {
    page = body.page.slice(0, MAX_PAGE);
  }

  return { ok: true, record: { nonce, interested: body.interested, platform, page } };
}
