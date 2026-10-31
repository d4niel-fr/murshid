import { describe, expect, it } from "vitest";
import {
  ageFromDob, canActivateConnector, canNotify, gradeEligible, hasGuardianConsent, isMinor, latestConsentStatus,
  meetsMinimumAge, milestoneProgress, requiresGuardianConsent,
} from "../src/index.js";

describe("ageFromDob", () => {
  it("counts whole years", () => {
    expect(ageFromDob("2009-03-14", "2026-10-10")).toBe(17);
    expect(ageFromDob("2010-10-10", "2026-10-10")).toBe(16);
    expect(ageFromDob("2010-10-11", "2026-10-10")).toBe(15);
  });
  it("handles leap-day birthdays like Postgres age()", () => {
    expect(ageFromDob("2012-02-29", "2026-02-28")).toBe(13);
    expect(ageFromDob("2012-02-29", "2026-03-01")).toBe(14);
  });
  it("accepts Date objects and rejects future DOBs", () => {
    expect(ageFromDob(new Date("2013-01-20T00:00:00Z"), new Date("2026-10-10T00:00:00Z"))).toBe(13);
    expect(() => ageFromDob("2030-01-01", "2026-10-10")).toThrow();
    expect(() => ageFromDob("nope", "2026-10-10")).toThrow();
  });
});

describe("age gate + consent", () => {
  const on = "2026-10-10";
  it("13+ only", () => {
    expect(meetsMinimumAge("2013-10-10", on)).toBe(true);
    expect(meetsMinimumAge("2013-10-11", on)).toBe(false);
  });
  it("under 18 requires guardian consent", () => {
    expect(isMinor("2008-10-11", on)).toBe(true);
    expect(requiresGuardianConsent({ date_of_birth: "2008-10-10" }, on)).toBe(false);
    expect(requiresGuardianConsent("2009-03-14", on)).toBe(true);
  });
  it("connectors and non-student notifications need consent for minors", () => {
    const minor = { date_of_birth: "2011-01-01" };
    const adult = { date_of_birth: "2007-01-01" };
    const pending = [{ consent_status: "pending" as const }];
    const granted = [{ consent_status: "revoked" as const }, { consent_status: "granted" as const }];
    expect(hasGuardianConsent(pending)).toBe(false);
    expect(canActivateConnector(minor, pending, on)).toBe(false);
    expect(canActivateConnector(minor, granted, on)).toBe(true);
    expect(canActivateConnector(adult, [], on)).toBe(true);
    expect(canNotify("student", minor, pending, on)).toBe(true);
    expect(canNotify("guardian", minor, pending, on)).toBe(false);
    expect(canNotify("counsellor", minor, granted, on)).toBe(true);
  });
  it("latest consent record per scope wins", () => {
    const recs = [
      { id: "a", scope: "counsellor_access", status: "granted" as const, created_at: "2026-09-10T20:16:00+04:00" },
      { id: "b", scope: "counsellor_access", status: "revoked" as const, created_at: "2026-10-01T21:00:00+04:00" },
      { id: "c", scope: "connectors", status: "granted" as const, created_at: "2026-10-05T00:00:00Z" },
    ];
    expect(latestConsentStatus(recs, "counsellor_access")).toBe("revoked");
    expect(latestConsentStatus(recs, "connectors")).toBe("granted");
    expect(latestConsentStatus(recs, "ai_processing")).toBeNull();
  });
});

describe("misc helpers", () => {
  it("gradeEligible", () => {
    expect(gradeEligible(10, { min_grade: 9, max_grade: 12 })).toBe(true);
    expect(gradeEligible(8, { min_grade: 9, max_grade: null })).toBe(false);
    expect(gradeEligible(13, { min_grade: null, max_grade: null })).toBe(true);
  });
  it("milestoneProgress", () => {
    expect(milestoneProgress([])).toBeNull();
    expect(milestoneProgress([{ done: true }, { done: false }, { done: false }])).toBe(33);
  });
});
