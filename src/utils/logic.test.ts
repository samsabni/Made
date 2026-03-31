import { describe, expect, it } from "vitest";
import type { Condition, GameVariable } from "../types";
import { evaluateConditions } from "./logic";

const variables: GameVariable[] = [
  { id: "variable-score", name: "score", type: "number", value: 12 },
  { id: "variable-target", name: "target", type: "number", value: 10 },
  { id: "variable-name", name: "name", type: "string", value: "made" },
];

describe("evaluateConditions", () => {
  it("supports a variable compared to a typed value", () => {
    const conditions: Condition[] = [
      {
        id: "condition-1",
        left: "",
        leftVariableId: "variable-score",
        operator: "greater_than",
        right: "10",
        rightMode: "value",
      },
    ];

    expect(evaluateConditions(conditions, { elements: [], variables })).toBe(true);
  });

  it("supports a variable compared to another variable", () => {
    const conditions: Condition[] = [
      {
        id: "condition-1",
        left: "",
        leftVariableId: "variable-score",
        operator: "greater_than",
        right: "",
        rightMode: "variable",
        rightVariableId: "variable-target",
      },
    ];

    expect(evaluateConditions(conditions, { elements: [], variables })).toBe(true);
  });
});
