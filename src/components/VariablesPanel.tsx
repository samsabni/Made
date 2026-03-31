import { useState } from "react";
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

const TYPE_COLORS: Record<VariableType, string> = {
  number: "#6366f1",
  boolean: "#10b981",
  string: "#f59e0b",
  string_array: "#3b82f6",
};

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
    <aside className="side-panel" style={{ width: 256 }}>
      <div className="side-panel-header">
        <span className="side-panel-title">Variables</span>
        <button className="side-panel-close" onClick={onClose} aria-label="Close variables panel">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="side-panel-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn btn-accent" style={{ width: "100%", justifyContent: "center" }} onClick={onCreateVariable} id="btn-new-variable">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New variable
          </button>

          {variables.length === 0 ? (
            <div className="empty-state">
              No variables yet.<br />Create one to store game state.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {variables.map((variable) => {
                const isExpanded = expandedVariableId === variable.id;
                const color = TYPE_COLORS[variable.type];
                return (
                  <div key={variable.id} className="card">
                    <button
                      className="card-header"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() =>
                        setExpandedVariableId((current) =>
                          current === variable.id ? null : variable.id
                        )
                      }
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: color,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className="card-name">{variable.name}</div>
                          <div className="card-meta">{formatVariableValue(variable)}</div>
                        </div>
                      </div>
                      <span className="card-badge">
                        {isExpanded ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="m18 15-6-6-6 6"/>
                          </svg>
                        ) : (
                          VARIABLE_LABELS[variable.type].slice(0, 3).toUpperCase()
                        )}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="card-body">
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                            value={
                              Array.isArray(variable.value)
                                ? variable.value.join(", ")
                                : String(variable.value)
                            }
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
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ marginTop: 2 }}
                            onClick={() => onDeleteVariable(variable.id)}
                          >
                            Delete variable
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
