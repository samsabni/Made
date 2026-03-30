import type {
  CanvasElementModel,
  Condition,
  GameVariable,
  TriggerAction,
  TriggerDefinition,
} from "../types";

interface LogicContext {
  elements: CanvasElementModel[];
  variables: GameVariable[];
}

/**
 * Converts user-authored values into comparable runtime values.
 * Variable names are resolved first so condition rows can refer to state directly.
 * @param rawValue - text coming from a condition row
 * @param variables - current runtime variables
 * @returns parsed primitive or raw string when no variable/value match exists
 */
function resolveValue(rawValue: string, variables: GameVariable[]) {
  const trimmed = rawValue.trim();
  const variable = variables.find((entry) => entry.name === trimmed);

  if (variable) {
    return variable.value;
  }

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (!Number.isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);

  return trimmed;
}

/**
 * Evaluates a flat condition list using the row-level join operator.
 * v1 intentionally avoids deep nesting so the result stays readable in the inspector.
 * @param conditions - ordered condition rows
 * @param context - runtime lookup state
 * @returns true when the condition set passes
 */
export function evaluateConditions(conditions: Condition[], context: LogicContext): boolean {
  if (conditions.length === 0) {
    return true;
  }

  return conditions.reduce<boolean>((currentResult, condition, index) => {
    const left = resolveValue(condition.left, context.variables);
    const right = resolveValue(condition.right, context.variables);

    const nextResult = compare(left, right, condition.operator);
    if (index === 0) {
      return nextResult;
    }

    return condition.join === "or" ? currentResult || nextResult : currentResult && nextResult;
  }, true);
}

function compare(left: unknown, right: unknown, operator: Condition["operator"]): boolean {
  switch (operator) {
    case "equals":
      return left === right;
    case "not_equals":
      return left !== right;
    case "greater_than":
      return Number(left) > Number(right);
    case "less_than":
      return Number(left) < Number(right);
    case "contains":
      return String(left).includes(String(right));
  }
}

/**
 * Detects whether a trigger should run in the current context.
 * @param trigger - trigger configuration attached to an element
 * @param changedVariableId - optional variable id for variable-change dispatch
 * @returns true when the trigger is allowed to execute
 */
export function shouldRunTrigger(trigger: TriggerDefinition, changedVariableId?: string): boolean {
  if (trigger.type !== "variable_change") {
    return true;
  }

  if (trigger.variableChangeMode === "any") {
    return true;
  }

  return trigger.targetVariableId === changedVariableId;
}

export function actionTargetsElement(action: TriggerAction): boolean {
  return (
    action.type === "change_text" ||
    action.type === "show_element" ||
    action.type === "hide_element" ||
    action.type === "bring_to_front" ||
    action.type === "send_to_back" ||
    action.type === "start_timer" ||
    action.type === "stop_timer" ||
    action.type === "pause_timer" ||
    action.type === "resume_timer"
  );
}

export function actionTargetsGroup(action: TriggerAction): boolean {
  return action.type === "show_group" || action.type === "hide_group";
}

export function actionTargetsVariable(action: TriggerAction): boolean {
  return (
    action.type === "set_variable" ||
    action.type === "add_number" ||
    action.type === "subtract_number" ||
    action.type === "toggle_boolean" ||
    action.type === "append_string_array" ||
    action.type === "remove_string_array"
  );
}
