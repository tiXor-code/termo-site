import { describe, expect, it } from "vitest";

import { ongoingForPt, restoreQualifier, type OngoingEpisode } from "@/lib/pt-live";
import type { Episode, PtYear } from "@/lib/data";

function ep(over: Partial<Episode> = {}): Episode {
  return {
    start: "2026-09-01T10:00",
    end: null,
    ongoing: true,
    uncertain: false,
    cause_class: "avarie",
    cause_raw: "avarie retea",
    remediere_last: "2026-09-04T15:30",
    ...over,
  };
}

function year(episodes: Episode[]): PtYear {
  return {
    days: 0,
    days_avarie: 0,
    days_programat: 0,
    days_deficienta: 0,
    episodes_count: episodes.length,
    longest_days: 0,
    est_hours: 0,
    runs: [],
    episodes,
  };
}

describe("ongoingForPt", () => {
  it("returns nothing when no episode is ongoing", () => {
    const years = { "2026": year([ep({ ongoing: false, end: "2026-09-02T08:00" })]) };
    expect(ongoingForPt(years)).toEqual([]);
  });

  it("surfaces an ongoing episode with its cause and estimated restore", () => {
    const years = { "2026": year([ep()]) };
    const got = ongoingForPt(years);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({
      start: "2026-09-01T10:00",
      cause_class: "avarie",
      remediere_last: "2026-09-04T15:30",
    });
  });

  // An episode crossing midnight on 31 Dec is published under both years.
  it("dedupes an episode that spans a year boundary", () => {
    const e = ep({ start: "2025-12-31T22:00" });
    const years = { "2025": year([e]), "2026": year([{ ...e }]) };
    expect(ongoingForPt(years)).toHaveLength(1);
  });

  it("puts avarie before programat, then newest start first", () => {
    const years = {
      "2026": year([
        ep({ start: "2026-09-03T09:00", cause_class: "programat" }),
        ep({ start: "2026-09-01T10:00", cause_class: "avarie" }),
        ep({ start: "2026-09-02T11:00", cause_class: "avarie" }),
      ]),
    };
    const got = ongoingForPt(years);
    expect(got.map((e: OngoingEpisode) => [e.cause_class, e.start])).toEqual([
      ["avarie", "2026-09-02T11:00"],
      ["avarie", "2026-09-01T10:00"],
      ["programat", "2026-09-03T09:00"],
    ]);
  });

  it("tolerates a missing estimated restore", () => {
    const years = { "2026": year([ep({ remediere_last: null })]) };
    expect(ongoingForPt(years)[0].remediere_last).toBeNull();
  });

  // Deploy-order safety: an older bundle, or a deficiency-only year, must not throw.
  it("survives a year with no episodes array", () => {
    const years = { "2026": { ...year([]), episodes: undefined } } as unknown as Record<
      string,
      PtYear
    >;
    expect(ongoingForPt(years)).toEqual([]);
  });

  it("ignores deficiency episodes - they are not an outage", () => {
    const years = {
      "2026": { ...year([]), episodes_deficienta: [ep()] } as PtYear,
    };
    expect(ongoingForPt(years)).toEqual([]);
  });
});

describe("restoreQualifier", () => {
  const asOf = "2026-09-04";

  it("marks the same calendar day", () => {
    expect(restoreQualifier("2026-09-04T23:00", asOf)).toBe("azi");
  });

  it("marks the next day", () => {
    expect(restoreQualifier("2026-09-05T08:00", asOf)).toBe("mâine");
  });

  it("counts days out beyond tomorrow", () => {
    expect(restoreQualifier("2026-09-07T20:00", asOf)).toBe("peste 3 zile");
    expect(restoreQualifier("2026-10-01T20:00", asOf)).toBe("peste 27 de zile");
  });

  // An estimate that has already passed while the outage is still flagged
  // ongoing is the most useful thing the page can say - and the easiest to hide.
  it("says so when the estimate has already passed", () => {
    expect(restoreQualifier("2026-09-03T10:00", asOf)).toBe("termen depășit");
  });

  it("returns null on unparsable input rather than throwing", () => {
    expect(restoreQualifier("nu se stie", asOf)).toBeNull();
    expect(restoreQualifier("2026-09-04T23:00", "garbage")).toBeNull();
  });
});
