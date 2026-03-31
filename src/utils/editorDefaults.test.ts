import { describe, expect, it } from "vitest";
import type { CanvasElementModel, GameVariable } from "../types";
import { getDefaultActionDraft } from "./editorDefaults";

function makeElement(overrides: Partial<CanvasElementModel> = {}): CanvasElementModel {
  return {
    id: "button-1",
    name: "Button 1",
    type: "button",
    x: 40,
    y: 40,
    width: 180,
    height: 48,
    zIndex: 1,
    text: "Play",
    visible: true,
    triggers: [],
    ...overrides,
  };
}

function makeVariable(overrides: Partial<GameVariable> = {}): GameVariable {
  return {
    id: "variable-1",
    name: "score",
    type: "number",
    value: 0,
    ...overrides,
  };
}

describe("getDefaultActionDraft", () => {
  it("defaults to setting the first variable when variables exist", () => {
    const action = getDefaultActionDraft(
      "action-1",
      makeElement(),
      [makeElement()],
      [makeVariable({ value: 5 })],
    );

    expect(action.type).toBe("set_variable");
    expect(action.targetVariableId).toBe("variable-1");
    expect(action.value).toBe("5");
  });

  it("falls back to changing the current element text when no variables exist", () => {
    const action = getDefaultActionDraft(
      "action-1",
      makeElement({ id: "text-1", type: "text", text: "Hello" }),
      [makeElement({ id: "text-1", type: "text", text: "Hello" })],
      [],
    );

    expect(action.type).toBe("change_text");
    expect(action.targetElementId).toBe("text-1");
    expect(action.value).toBe("Hello");
  });
});
