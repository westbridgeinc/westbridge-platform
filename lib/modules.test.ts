import { describe, it, expect } from "vitest";
import type { PlanId } from "./modules";
import {
  MODULES,
  MODULE_IDS,
  PLANS,
  CATEGORIES,
  getPlan,
  getModule,
  isModuleIncludedInPlan,
  getAddOnPrice,
  MODULE_ROWS,
} from "./modules";

describe("modules", () => {
  it("MODULES and MODULE_IDS length match", () => {
    expect(MODULES.length).toBe(MODULE_IDS.length);
  });
  it("PLANS has starter business enterprise", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["starter", "business", "enterprise"]);
  });
  it("getPlan returns plan by id", () => {
    expect(getPlan("starter").name).toBe("Starter");
    expect(getPlan("enterprise").limits.users).toBe(-1);
  });
  it("getPlan throws for unknown id", () => {
    expect(() => getPlan("unknown" as PlanId)).toThrow("Unknown plan");
  });
  it("getModule returns module or undefined", () => {
    expect(getModule("general-ledger")?.name).toBe("General Ledger");
    expect(getModule("nonexistent")).toBeUndefined();
  });
  it("isModuleIncludedInPlan", () => {
    expect(isModuleIncludedInPlan("general-ledger", "starter")).toBe(true);
    expect(isModuleIncludedInPlan("stock-management", "starter")).toBe(false);
  });
  it("getAddOnPrice enterprise returns null", () => {
    expect(getAddOnPrice("stock-management", "enterprise")).toBeNull();
  });
  it("getAddOnPrice included module returns null", () => {
    expect(getAddOnPrice("general-ledger", "starter")).toBeNull();
  });
  it("getAddOnPrice add-on returns number", () => {
    expect(getAddOnPrice("stock-management", "starter")).toBe(349);
  });
  it("CATEGORIES and MODULE_ROWS", () => {
    expect(CATEGORIES).toContain("Finance & Accounting");
    expect(MODULE_ROWS.length).toBe(MODULES.length);
  });
});
