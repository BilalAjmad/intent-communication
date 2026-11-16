import { describe, it, expect } from "vitest";
import { computeAcceptanceRate } from "./metrics.js";

const obj = (id: string) => ({ id, type: "text" });

describe("computeAcceptanceRate (trd 17.2)", () => {
  it("reports 100% unchanged when no patches were applied after baseline", () => {
    const result = computeAcceptanceRate({
      baselineObjects: { a: obj("a"), b: obj("b") },
      currentObjects: { a: obj("a"), b: obj("b") },
      appliedPatches: [],
    });
    expect(result.available).toBe(true);
    expect(result.unchanged).toBe(2);
    expect(result.changed).toBe(0);
    expect(result.acceptanceRate).toBe(1);
    expect(result.total).toBe(2);
  });

  it("counts only still-present baseline objects in the changed set", () => {
    const result = computeAcceptanceRate({
      baselineObjects: { a: obj("a"), b: obj("b") },
      currentObjects: { a: obj("a") }, // b removed by agent or user
      appliedPatches: [{ objectId: "b", appliedAt: "2026-11-16T00:00:00Z" }],
    });
    expect(result.baselineObjectsStillPresent).toBe(1);
    expect(result.removedAfterBaseline).toBe(1);
    // a was not patched; b (which was patched) is absent from the denominator.
    expect(result.unchanged).toBe(1);
    expect(result.acceptanceRate).toBe(1);
  });

  it("reports added and unchanged counts separately", () => {
    const result = computeAcceptanceRate({
      baselineObjects: { a: obj("a") },
      currentObjects: { a: obj("a"), x: obj("x"), y: obj("y") },
      appliedPatches: [],
    });
    expect(result.addedAfterBaseline).toBe(2);
    expect(result.baselineObjectsStillPresent).toBe(1);
    expect(result.acceptanceRate).toBe(1);
  });

  it("reports 0% when every baseline object was patched", () => {
    const result = computeAcceptanceRate({
      baselineObjects: { a: obj("a"), b: obj("b") },
      currentObjects: { a: obj("a"), b: obj("b") },
      appliedPatches: [{ objectId: "a" }, { objectId: "b" }],
    });
    expect(result.unchanged).toBe(0);
    expect(result.changed).toBe(2);
    expect(result.acceptanceRate).toBe(0);
  });

  it("ignores patches with a null objectId", () => {
    const result = computeAcceptanceRate({
      baselineObjects: { a: obj("a") },
      currentObjects: { a: obj("a") },
      appliedPatches: [{ objectId: null }],
    });
    expect(result.unchanged).toBe(1);
    expect(result.acceptanceRate).toBe(1);
  });

  it("is unavailable with a reason when the baseline had no objects", () => {
    const result = computeAcceptanceRate({
      baselineObjects: {},
      currentObjects: { x: obj("x") },
      appliedPatches: [],
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe("baseline had no objects");
    expect(result.acceptanceRate).toBeNull();
    expect(result.addedAfterBaseline).toBe(1);
  });

  it("is unavailable when every baseline object was removed", () => {
    const result = computeAcceptanceRate({
      baselineObjects: { a: obj("a"), b: obj("b") },
      currentObjects: { x: obj("x") },
      appliedPatches: [],
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe("all baseline objects were removed");
    expect(result.removedAfterBaseline).toBe(2);
    expect(result.addedAfterBaseline).toBe(1);
    expect(result.total).toBe(1);
  });

  it("mixed scenario: some patched, some added, one removed", () => {
    const result = computeAcceptanceRate({
      baselineObjects: { a: obj("a"), b: obj("b"), c: obj("c") },
      currentObjects: { a: obj("a"), c: obj("c"), d: obj("d") }, // b removed, d added
      appliedPatches: [{ objectId: "c" }],
    });
    expect(result.baselineObjectsStillPresent).toBe(2);
    expect(result.removedAfterBaseline).toBe(1);
    expect(result.addedAfterBaseline).toBe(1);
    expect(result.unchanged).toBe(1); // a kept
    expect(result.changed).toBe(1); // c patched
    expect(result.acceptanceRate).toBe(0.5);
  });
});
