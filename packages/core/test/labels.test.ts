import { describe, expect, it } from "vitest";
import {
  ChartSpecSchema, ENUM_LABELS, EMIRATES, OPPORTUNITY_TYPES, enumLabel, enumOptions, humanizeEnum,
} from "../src/index.js";

describe("enum display labels", () => {
  it("labels raw enum values in English and Arabic", () => {
    expect(enumLabel("emirate", "abu_dhabi")).toBe("Abu Dhabi");
    expect(enumLabel("emirate", "abu_dhabi", "ar")).toBe("أبوظبي");
    expect(enumLabel("opportunityType", "summer_program")).toBe("Summer programme");
    expect(enumLabel("opportunityType", "mun")).toBe("Model UN");
    expect(enumLabel("curriculum", "indian_cbse")).toBe("Indian (CBSE)");
  });
  it("covers every value of every labelled enum with non-empty en + ar", () => {
    for (const v of EMIRATES) expect(ENUM_LABELS.emirate[v].en).not.toMatch(/_/);
    for (const v of OPPORTUNITY_TYPES) expect(ENUM_LABELS.opportunityType[v].en).not.toMatch(/_/);
    for (const map of Object.values(ENUM_LABELS)) {
      for (const lb of Object.values(map as Record<string, { en: string; ar: string }>)) {
        expect(lb.en.length).toBeGreaterThan(0);
        expect(lb.ar.length).toBeGreaterThan(0);
      }
    }
  });
  it("never returns raw snake_case for unknown / legacy values", () => {
    expect(enumLabel("emirate", "Dubai")).toBe("Dubai");
    expect(enumLabel("emirate", "Ras Al Khaimah")).toBe("Ras Al Khaimah");
    expect(enumLabel("opportunityType", "research_camp")).toBe("Research camp");
    expect(enumLabel("emirate", null)).toBe("");
    expect(humanizeEnum("umm_al_quwain")).toBe("Umm al quwain");
  });
  it("builds option lists", () => {
    const opts = enumOptions("opportunityType");
    expect(opts).toHaveLength(OPPORTUNITY_TYPES.length);
    expect(opts.find((o) => o.value === "summer_program")?.label).toBe("Summer programme");
  });
});

describe("ChartSpec schema", () => {
  const spec = {
    id: "gym-4w", type: "bar", title: "Gym", xKey: "label", series: [{ key: "minutes", label: "Minutes" }],
    data: [{ label: "5 Oct", minutes: 120 }], insight: "Up 10%.", generatedBy: "rules",
  };
  it("accepts a valid spec and rejects rows without the x key", () => {
    expect(ChartSpecSchema.parse(spec).id).toBe("gym-4w");
    expect(() => ChartSpecSchema.parse({ ...spec, data: [{ minutes: 1 }] })).toThrow();
    expect(() => ChartSpecSchema.parse({ ...spec, type: "donut" })).toThrow();
  });
});
