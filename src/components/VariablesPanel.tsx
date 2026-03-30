import { useState } from "react";
import { Button } from "@heroui/react";
import { VARIABLE_LABELS } from "../constants";
import type { GameVariable, PanelState, VariableType } from "../types";
import { SelectField, TextInput } from "./FormControls";

interface VariablesPanelProps {
  panelState: PanelState;
  variables: GameVariable[];
  onCreateVariable: () => void;
  onUpdateVariable: (variableId: string, patch: Partial<GameVariable>) => void;
  onDeleteVariable: (variableId: string) => void;
  onClose: () => void;
}

export function VariablesPanel({
  panelState,
  variables,
  onCreateVariable,
  onUpdateVariable,
  onDeleteVariable,
  onClose,
}: VariablesPanelProps) {
  const [expandedVariableId, setExpandedVariableId] = useState<string | null>(null);

  if (!panelState.open) {
    return null;
  }

  /**
   * Formats a variable value into a compact summary string for the collapsed list.
   * @param variable - current variable row
   * @returns short readable value preview
   */
  function formatVariableValue(variable: GameVariable) {
    if (Array.isArray(variable.value)) {
      return variable.value.length === 0 ? "[]" : variable.value.join(", ");
    }

    if (variable.type === "string" && variable.value === "") {
      return '""';
    }

    return String(variable.value);
  }

  return (
    <aside className="panel-shell w-72">
      <div className="panel-header">
        <div className="panel-title">Variables</div>
        <div className="flex gap-1">
          <button className="panel-icon" onClick={onClose}>
            x
          </button>
        </div>
      </div>
      <div className="space-y-3">
        <Button size="sm" color="primary" variant="flat" onPress={onCreateVariable}>
          New variable
        </Button>
        {variables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-3 text-sm text-slate-400">
            No variables yet. Create one to store state.
          </div>
        ) : (
          <div className="space-y-3">
            {variables.map((variable) => (
              <div key={variable.id} className="border border-stone-200 bg-white">
                <button
                  className="flex w-full items-center justify-between px-3 py-3 text-left"
                  onClick={() =>
                    setExpandedVariableId((current) => (current === variable.id ? null : variable.id))
                  }
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-stone-900">{variable.name}</div>
                    <div className="truncate text-xs text-stone-500">{formatVariableValue(variable)}</div>
                  </div>
                  <div className="ml-3 shrink-0 text-xs uppercase tracking-wide text-stone-400">
                    {expandedVariableId === variable.id ? "Hide" : VARIABLE_LABELS[variable.type]}
                  </div>
                </button>
                {expandedVariableId === variable.id && (
                  <div className="border-t border-stone-200 px-3 pb-3 pt-3">
                    <div className="mb-3 grid gap-2">
                      <TextInput
                        label="Name"
                        value={variable.name}
                        onChange={(value) => onUpdateVariable(variable.id, { name: value })}
                      />
                      <SelectField
                        label="Type"
                        value={variable.type}
                        options={Object.entries(VARIABLE_LABELS).map(([key, label]) => ({
                          value: key,
                          label,
                        }))}
                        onChange={(rawValue) => {
                          const value = rawValue as VariableType;
                          onUpdateVariable(variable.id, {
                            type: value,
                            value:
                              value === "boolean"
                                ? false
                                : value === "number"
                                  ? 0
                                  : value === "string"
                                    ? ""
                                    : [],
                          });
                        }}
                      />
                      <TextInput
                        label="Value"
                        value={Array.isArray(variable.value) ? variable.value.join(", ") : String(variable.value)}
                        onChange={(nextValue) =>
                          onUpdateVariable(variable.id, {
                            value:
                              variable.type === "boolean"
                                ? nextValue === "true"
                                : variable.type === "number"
                                  ? Number(nextValue || 0)
                                  : variable.type === "string_array"
                                    ? nextValue
                                        .split(",")
                                        .map((entry) => entry.trim())
                                        .filter(Boolean)
                                    : nextValue,
                          })
                        }
                      />
                    </div>
                    <Button size="sm" color="danger" variant="light" onPress={() => onDeleteVariable(variable.id)}>
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
