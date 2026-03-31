import type { CanvasElementModel, GameVariable, PrimitiveValue, TriggerAction } from "../types";

function serializePrimitiveValue(value: PrimitiveValue): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

export function getDefaultActionDraft(
  id: string,
  sourceElement: CanvasElementModel,
  _elements: CanvasElementModel[],
  variables: GameVariable[],
): TriggerAction {
  const firstVariable = variables[0];
  if (firstVariable) {
    return {
      id,
      type: "set_variable",
      targetVariableId: firstVariable.id,
      value: serializePrimitiveValue(firstVariable.value),
    };
  }

  return {
    id,
    type: "change_text",
    targetElementId: sourceElement.id,
    value: sourceElement.text,
  };
}
