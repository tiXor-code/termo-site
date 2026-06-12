// Pure validation for the feedback API - kept dependency-free so vitest can
// exercise it without the route handler's runtime.

export interface FeedbackInput {
  vote?: unknown;
  message?: unknown;
  page?: unknown;
  website?: unknown; // honeypot: humans never fill it
}

export interface FeedbackRecord {
  vote: "up" | "down";
  message: string | null;
  page: string | null;
}

export type FeedbackResult =
  | { ok: true; record: FeedbackRecord }
  | { ok: false; reason: "honeypot" | "invalid" };

const MAX_MESSAGE = 2000;
const MAX_PAGE = 200;

export function validateFeedback(body: FeedbackInput): FeedbackResult {
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return { ok: false, reason: "honeypot" };
  }
  if (body.vote !== "up" && body.vote !== "down") {
    return { ok: false, reason: "invalid" };
  }
  let message: string | null = null;
  if (typeof body.message === "string" && body.message.trim() !== "") {
    message = body.message.trim().slice(0, MAX_MESSAGE);
  }
  let page: string | null = null;
  if (typeof body.page === "string" && body.page.startsWith("/")) {
    page = body.page.slice(0, MAX_PAGE);
  }
  return { ok: true, record: { vote: body.vote, message, page } };
}
