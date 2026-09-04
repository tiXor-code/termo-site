import { describe, expect, it } from "vitest";

import { validateAppPoll } from "@/lib/app-poll";

const NONCE = "8f14e45f-ea8f-4b2d-9f1a-3c7d5b6e0a91";

describe("validateAppPoll", () => {
  it("accepts a bare 'nu' answer", () => {
    const r = validateAppPoll({ nonce: NONCE, interested: false });
    expect(r).toEqual({
      ok: true,
      record: { nonce: NONCE, interested: false, platform: null, page: null },
    });
  });

  it("accepts 'da' with a platform", () => {
    const r = validateAppPoll({ nonce: NONCE, interested: true, platform: "android" });
    if (!r.ok) throw new Error("expected ok");
    expect(r.record.platform).toBe("android");
    expect(r.record.interested).toBe(true);
  });

  it("accepts 'da' before a platform is chosen", () => {
    const r = validateAppPoll({ nonce: NONCE, interested: true });
    if (!r.ok) throw new Error("expected ok");
    expect(r.record.platform).toBeNull();
  });

  it("flags honeypot submissions", () => {
    expect(
      validateAppPoll({ nonce: NONCE, interested: true, website: "spam.example" }),
    ).toEqual({ ok: false, reason: "honeypot" });
  });

  it("empty honeypot is fine", () => {
    expect(validateAppPoll({ nonce: NONCE, interested: true, website: "" }).ok).toBe(true);
  });

  it("rejects a missing or non-boolean interest", () => {
    expect(validateAppPoll({ nonce: NONCE })).toEqual({ ok: false, reason: "invalid" });
    expect(validateAppPoll({ nonce: NONCE, interested: "da" })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects unknown platforms", () => {
    expect(
      validateAppPoll({ nonce: NONCE, interested: true, platform: "windows-phone" }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  // The DB carries the same rule as a CHECK constraint; rejecting it here keeps
  // a nonsense row from ever reaching PostgREST.
  it("rejects a platform paired with 'nu'", () => {
    expect(validateAppPoll({ nonce: NONCE, interested: false, platform: "ios" })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("requires a UUID nonce", () => {
    expect(validateAppPoll({ nonce: "not-a-uuid", interested: true })).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(validateAppPoll({ interested: true })).toEqual({ ok: false, reason: "invalid" });
    // No unbounded strings reach the unique index.
    expect(validateAppPoll({ nonce: "x".repeat(500), interested: true })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("normalises the nonce to lower case", () => {
    const r = validateAppPoll({ nonce: NONCE.toUpperCase(), interested: false });
    if (!r.ok) throw new Error("expected ok");
    expect(r.record.nonce).toBe(NONCE);
  });

  it("page must be a site-relative path", () => {
    const ok = validateAppPoll({
      nonce: NONCE,
      interested: true,
      page: "/strada/sos-pantelimon",
    });
    if (!ok.ok) throw new Error("expected ok");
    expect(ok.record.page).toBe("/strada/sos-pantelimon");
    const bad = validateAppPoll({ nonce: NONCE, interested: true, page: "https://evil.example" });
    if (!bad.ok) throw new Error("expected ok");
    expect(bad.record.page).toBeNull();
  });

  it("clips overlong pages", () => {
    const r = validateAppPoll({ nonce: NONCE, interested: true, page: "/" + "a".repeat(500) });
    if (!r.ok) throw new Error("expected ok");
    expect(r.record.page).toHaveLength(200);
  });
});
