export type ElementType = "button" | "text" | "panel" | "group" | "input";
export type VariableType = "boolean" | "number" | "string" | "string_array";
export type TriggerType = "click" | "timer" | "variable_change";
export type ValueSourceMode = "static" | "variable";
export type FontWeightOption = "regular" | "medium" | "semibold" | "bold";
export type ActionType =
  | "set_variable"
  | "add_number"
  | "subtract_number"
  | "toggle_boolean"
  | "append_string_array"
  | "remove_string_array"
  | "change_text"
  | "show_element"
  | "hide_element"
  | "show_group"
  | "hide_group"
  | "bring_to_front"
  | "send_to_back"
  | "start_timer"
  | "stop_timer"
  | "pause_timer"
  | "resume_timer";

export type PrimitiveValue = boolean | number | string | string[];
export type ConditionJoin = "and" | "or";
export type ComparisonOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "contains";

export interface GameVariable {
  id: string;
  name: string;
  type: VariableType;
  value: PrimitiveValue;
}

export interface Condition {
  id: string;
  left: string;
  operator: ComparisonOperator;
  right: string;
  join?: ConditionJoin;
}

export interface TriggerAction {
  id: string;
  type: ActionType;
  targetVariableId?: string;
  targetElementId?: string;
  targetGroupId?: string;
  value?: string;
}

export interface TriggerDefinition {
  id: string;
  type: TriggerType;
  conditions: Condition[];
  actions: TriggerAction[];
  hasElse?: boolean;
  elseActions?: TriggerAction[];
  timerIntervalMs?: number;
  timerAutoStart?: boolean;
  variableChangeMode?: "any" | "specific";
  targetVariableId?: string;
}

export interface CanvasElementModel {
  id: string;
  name: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  text: string;
  textSourceMode?: ValueSourceMode;
  textVariableId?: string;
  fontSize?: number;
  fontWeight?: FontWeightOption;
  fontItalic?: boolean;
  buttonBackgroundMode?: ValueSourceMode;
  buttonBackgroundColor?: string;
  buttonBackgroundVariableId?: string;
  buttonTextColorMode?: ValueSourceMode;
  buttonTextColor?: string;
  buttonTextColorVariableId?: string;
  visible: boolean;
  groupId?: string;
  triggers: TriggerDefinition[];
}

export interface PanelState {
  open: boolean;
  minimized: boolean;
}

export interface PanelVisibilityState {
  left: PanelState;
  right: PanelState;
  variables: PanelState;
}

export interface TimerState {
  running: boolean;
  paused: boolean;
  startedAt: number | null;
  remainingMs: number | null;
  intervalMs: number;
}

export interface RuntimeTimers {
  [key: string]: TimerState | undefined;
}

export interface AppDocument {
  elements: CanvasElementModel[];
  variables: GameVariable[];
  settings?: {
    snapToGrid?: boolean;
  };
  viewport?: {
    x: number;
    y: number;
    scale: number;
  };
  panelVisibility?: PanelVisibilityState;
}
