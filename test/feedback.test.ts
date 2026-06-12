import { describe, expect, it } from "vitest";

import { validateFeedback } from "@/lib/feedback";

describe("validateFeedback", () => {
  it("accepts a bare up-vote", () => {
    const r = validateFeedback({ vote: "up" });
    expect(r).toEqual({ ok: true, record: { vote: "up", message: null, page: null } });
  });

  it("rejects unknown votes", () => {
    expect(validateFeedback({ vote: "sideways" })).toEqual({ ok: false, reason: "invalid" });
    expect(validateFeedback({})).toEqual({ ok: false, reason: "invalid" });
    expect(validateFeedback({ vote: 1 })).toEqual({ ok: false, reason: "invalid" });
  });

  it("flags honeypot submissions", () => {
    expect(validateFeedback({ vote: "up", website: "spam.example" })).toEqual({
      ok: false,
      reason: "honeypot",
    });
  });

  it("empty honeypot is fine", () => {
    expect(validateFeedback({ vote: "down", website: "" }).ok).toBe(true);
  });

  it("trims and clips messages to 2000 chars", () => {
    const r = validateFeedback({ vote: "down", message: "  " + "x".repeat(3000) + "  " });
    if (!r.ok) throw new Error("expected ok");
    expect(r.record.message).toHaveLength(2000);
  });

  it("blank message becomes null", () => {
    const r = validateFeedback({ vote: "down", message: "   " });
    if (!r.ok) throw new Error("expected ok");
    expect(r.record.message).toBeNull();
  });

  it("page must be a site-relative path", () => {
    const ok = validateFeedback({ vote: "up", page: "/strada/sos-pantelimon" });
    if (!ok.ok) throw new Error("expected ok");
    expect(ok.record.page).toBe("/strada/sos-pantelimon");
    const bad = validateFeedback({ vote: "up", page: "https://evil.example" });
    if (!bad.ok) throw new Error("expected ok");
    expect(bad.record.page).toBeNull();
  });

  it("clips overlong pages", () => {
    const r = validateFeedback({ vote: "up", page: "/" + "a".repeat(500) });
    if (!r.ok) throw new Error("expected ok");
    expect(r.record.page).toHaveLength(200);
  });
});
