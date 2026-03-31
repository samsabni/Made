import type {
  ActionType,
  CanvasElementModel,
  ElementType,
  GameVariable,
  TriggerDefinition,
  VariableType,
} from "./types";

export const CANVAS_WIDTH = 2200;
export const CANVAS_HEIGHT = 1400;
export const GRID_SIZE = 18;

export const ELEMENT_LABELS: Record<ElementType, string> = {
  button: "Button",
  text: "Text",
  panel: "Panel",
  group: "Group",
  input: "Input",
};

export const VARIABLE_LABELS: Record<VariableType, string> = {
  boolean: "boolean",
  number: "number",
  string: "string",
  string_array: "array of strings",
};

export const ACTION_LABELS: Record<ActionType, string> = {
  set_variable: "Set variable",
  add_number: "Add to number variable",
  subtract_number: "Subtract from number variable",
  toggle_boolean: "Toggle boolean",
  append_string_array: "Append string to array",
  remove_string_array: "Remove string from array",
  change_text: "Change text",
  show_element: "Show element",
  hide_element: "Hide element",
  show_group: "Show group",
  hide_group: "Hide group",
  bring_to_front: "Bring to front",
  send_to_back: "Send to back",
  start_timer: "Start timer",
  stop_timer: "Stop timer",
  pause_timer: "Pause timer",
  resume_timer: "Resume timer",
};

export const NEW_VARIABLE_DEFAULTS: Record<VariableType, PrimitiveFactory> = {
  boolean: () => false,
  number: () => 0,
  string: () => "",
  string_array: () => [],
};

type PrimitiveFactory = () => GameVariable["value"];

/**
 * Creates a new element shell with predictable defaults for the canvas.
 * @param type - the requested element type
 * @param id - stable element id
 * @param name - display name shown in dropdowns and inspector
 * @param zIndex - render order for overlap
 * @param x - initial horizontal position
 * @param y - initial vertical position
 * @returns a ready-to-insert canvas element
 */
export function createDefaultElement(
  type: ElementType,
  id: string,
  name: string,
  zIndex: number,
  x: number,
  y: number,
): CanvasElementModel {
  const base = {
    id,
    name,
    type,
    x,
    y,
    zIndex,
    visible: true,
    triggers: [],
    groupId: undefined,
  };

  switch (type) {
    case "button":
      return {
        ...base,
        width: 148,
        height: 44,
        text: "Click me",
        textSourceMode: "static",
        fontSize: 14,
        fontWeight: "semibold",
        fontItalic: false,
        buttonBackgroundMode: "static",
        buttonBackgroundColor: "#ffffff",
        buttonTextColorMode: "static",
        buttonTextColor: "#18181b",
      };
    case "text":
      return {
        ...base,
        width: 180,
        height: 36,
        text: "Text",
        fontSize: 20,
        fontWeight: "medium",
        fontItalic: false,
      };
    case "panel":
      return { ...base, width: 240, height: 160, text: "Panel" };
    case "group":
      return { ...base, width: 220, height: 120, text: "Group" };
    case "input":
      return { ...base, width: 200, height: 44, text: "Type here" };
  }
}

/**
 * Creates a minimal trigger stub so the inspector can add rules quickly.
 * @param id - stable trigger id
 * @param type - trigger kind selected by the user
 * @returns trigger definition with sensible defaults
 */
export function createDefaultTrigger(id: string, type: TriggerDefinition["type"]): TriggerDefinition {
  if (type === "timer") {
    return {
      id,
      type,
      conditions: [],
      actions: [],
      hasElse: false,
      elseActions: [],
      timerIntervalMs: 1000,
      timerAutoStart: false,
    };
  }

  if (type === "variable_change") {
    return {
      id,
      type,
      conditions: [],
      actions: [],
      hasElse: false,
      elseActions: [],
      variableChangeMode: "any",
    };
  }

  return {
    id,
    type,
    conditions: [],
    actions: [],
    hasElse: false,
    elseActions: [],
  };
}
