import type { GameVariable } from "../types";

/**
 * Replaces `{variableName}` tokens in text with current variable values.
 * @param rawText - author-edited text content containing optional bindings
 * @param variables - current runtime variables
 * @returns rendered text shown on the canvas
 */
export function renderBoundText(rawText: string, variables: GameVariable[]): string {
  return rawText.replace(/\{([^}]+)\}/g, (_, bindingName: string) => {
    const variable = variables.find((entry) => entry.name === bindingName.trim());
    if (!variable) {
      return `{${bindingName}}`;
    }

    if (Array.isArray(variable.value)) {
      return variable.value.join(", ");
    }

    return String(variable.value);
  });
}

export function getVariableDisplayValue(variableId: string | undefined, variables: GameVariable[]): string {
  if (!variableId) {
    return "";
  }

  const variable = variables.find((entry) => entry.id === variableId);
  if (!variable) {
    return "";
  }

  if (Array.isArray(variable.value)) {
    return variable.value.join(", ");
  }

  return String(variable.value);
}
