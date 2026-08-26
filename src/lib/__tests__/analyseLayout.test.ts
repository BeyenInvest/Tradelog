import { describe, it, expect } from "vitest";
import { applyOrder, moveId, toggleId } from "../analyseLayout";

describe("applyOrder", () => {
  it("returns the default order when nothing is saved", () => {
    expect(applyOrder(["a", "b", "c"], [])).toEqual(["a", "b", "c"]);
  });

  it("follows the saved order for known ids", () => {
    expect(applyOrder(["a", "b", "c"], ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  it("drops saved ids that are no longer visible", () => {
    expect(applyOrder(["a", "b"], ["c", "b", "a"])).toEqual(["b", "a"]);
  });

  it("appends newly-added ids (absent from the saved order) after the known ones, in default order", () => {
    expect(applyOrder(["a", "b", "c", "d"], ["c", "a"])).toEqual(["c", "a", "b", "d"]);
  });
});

describe("moveId", () => {
  it("moves an id to sit just before the target", () => {
    expect(moveId(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("moves upward-to-downward correctly", () => {
    expect(moveId(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
  });

  it("is a no-op when from equals to, or an id is missing", () => {
    expect(moveId(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "x", "a")).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "a", "x")).toEqual(["a", "b"]);
  });
});

describe("toggleId", () => {
  it("adds when absent and removes when present", () => {
    expect(toggleId([], "a")).toEqual(["a"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });
});
