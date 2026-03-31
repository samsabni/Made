import { LogicEditor } from "./LogicEditor";
import { SelectField, TextInput, Toggle } from "./FormControls";
import type {
  CanvasElementModel,
  Condition,
  GameVariable,
  PanelState,
  TriggerAction,
  TriggerDefinition,
  TriggerType,
} from "../types";

const FONT_WEIGHT_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "medium", label: "Medium" },
  { value: "semibold", label: "Semi-bold" },
  { value: "bold", label: "Bold" },
];

interface RightInspectorPanelProps {
  panelState: PanelState;
  selectedElement: CanvasElementModel | null;
  elements: CanvasElementModel[];
  variables: GameVariable[];
  onUpdateElement: (elementId: string, patch: Partial<CanvasElementModel>) => void;
  onBringToFront: (elementId: string) => void;
  onSendToBack: (elementId: string) => void;
  onDeleteElement: (elementId: string) => void;
  onClose: () => void;
  onAddTrigger: (elementId: string, type: TriggerType) => void;
  onUpdateTrigger: (elementId: string, triggerId: string, patch: Partial<TriggerDefinition>) => void;
  onDeleteTrigger: (elementId: string, triggerId: string) => void;
  onAddAction: (elementId: string, triggerId: string, branch?: "then" | "else") => void;
  onUpdateAction: (
    elementId: string,
    triggerId: string,
    actionId: string,
    patch: Partial<TriggerAction>,
    branch?: "then" | "else",
  ) => void;
  onDeleteAction: (
    elementId: string,
    triggerId: string,
    actionId: string,
    branch?: "then" | "else",
  ) => void;
  onAddCondition: (elementId: string, triggerId: string) => void;
  onUpdateCondition: (
    elementId: string,
    triggerId: string,
    conditionId: string,
    patch: Partial<Condition>,
  ) => void;
  onDeleteCondition: (elementId: string, triggerId: string, conditionId: string) => void;
}

export function RightInspectorPanel(props: RightInspectorPanelProps) {
  const {
    panelState,
    selectedElement,
    elements,
    variables,
    onUpdateElement,
    onBringToFront,
    onSendToBack,
    onDeleteElement,
    onClose,
    onAddTrigger,
    onUpdateTrigger,
    onDeleteTrigger,
    onAddAction,
    onUpdateAction,
    onDeleteAction,
    onAddCondition,
    onUpdateCondition,
    onDeleteCondition,
  } = props;

  const stringVariables = variables.filter((variable) => variable.type === "string");

  if (!panelState.open) {
    return null;
  }

  return (
    <aside className="side-panel right" style={{ width: 276 }}>
      <div className="side-panel-header">
        <span className="side-panel-title">Inspector</span>
        <button className="side-panel-close" onClick={onClose} aria-label="Close inspector">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="side-panel-body">
        {!selectedElement ? (
          <div className="empty-state" style={{ marginTop: 48 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8, opacity: 0.4 }}>
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
            </svg>
            Click an element on the canvas to inspect and edit it.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Element identity */}
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="inspector-element-name">{selectedElement.name}</div>

              <TextInput
                label="Name"
                value={selectedElement.name}
                onChange={(value) => onUpdateElement(selectedElement.id, { name: value })}
              />
              <TextInput
                label={selectedElement.type === "button" ? "Button label" : "Text"}
                value={selectedElement.text}
                onChange={(value) => onUpdateElement(selectedElement.id, { text: value })}
              />

              {(selectedElement.type === "button" || selectedElement.type === "text") && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <TextInput
                      type="number"
                      label="Font size"
                      value={String(selectedElement.fontSize ?? (selectedElement.type === "text" ? 20 : 14))}
                      onChange={(value) =>
                        onUpdateElement(selectedElement.id, {
                          fontSize: Number(value || (selectedElement.type === "text" ? 20 : 14)),
                        })
                      }
                    />
                    <SelectField
                      label="Weight"
                      value={selectedElement.fontWeight ?? (selectedElement.type === "text" ? "medium" : "semibold")}
                      options={FONT_WEIGHT_OPTIONS}
                      onChange={(value) =>
                        onUpdateElement(selectedElement.id, {
                          fontWeight: value as CanvasElementModel["fontWeight"],
                        })
                      }
                    />
                  </div>

                  <Toggle
                    label="Italic"
                    checked={Boolean(selectedElement.fontItalic)}
                    onChange={(checked) =>
                      onUpdateElement(selectedElement.id, { fontItalic: checked })
                    }
                  />
                </>
              )}

              {selectedElement.type === "button" && (
                <>
                  <SelectField
                    label="Label source"
                    value={selectedElement.textSourceMode ?? "static"}
                    options={[
                      { value: "static", label: "Static text" },
                      { value: "variable", label: "Variable" },
                    ]}
                    onChange={(value) =>
                      onUpdateElement(selectedElement.id, {
                        textSourceMode: value as "static" | "variable",
                      })
                    }
                  />
                  {selectedElement.textSourceMode === "variable" && (
                    <SelectField
                      label="Label variable"
                      value={selectedElement.textVariableId}
                      placeholder="Select string variable"
                      options={stringVariables.map((variable) => ({
                        value: variable.id,
                        label: `${variable.name} (${variable.type})`,
                      }))}
                      onChange={(value) =>
                        onUpdateElement(selectedElement.id, {
                          textVariableId: value || undefined,
                        })
                      }
                    />
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <SelectField
                        label="Fill source"
                        value={selectedElement.buttonBackgroundMode ?? "static"}
                        options={[
                          { value: "static", label: "Static" },
                          { value: "variable", label: "Variable" },
                        ]}
                        onChange={(value) =>
                          onUpdateElement(selectedElement.id, {
                            buttonBackgroundMode: value as "static" | "variable",
                          })
                        }
                      />
                      {selectedElement.buttonBackgroundMode === "variable" ? (
                        <SelectField
                          label="Fill variable"
                          value={selectedElement.buttonBackgroundVariableId}
                          placeholder="Select string variable"
                          options={stringVariables.map((variable) => ({
                            value: variable.id,
                            label: variable.name,
                          }))}
                          onChange={(value) =>
                            onUpdateElement(selectedElement.id, {
                              buttonBackgroundVariableId: value || undefined,
                            })
                          }
                        />
                      ) : (
                        <TextInput
                          type="color"
                          label="Fill color"
                          value={selectedElement.buttonBackgroundColor ?? "#ffffff"}
                          onChange={(value) =>
                            onUpdateElement(selectedElement.id, { buttonBackgroundColor: value })
                          }
                        />
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <SelectField
                        label="Text color source"
                        value={selectedElement.buttonTextColorMode ?? "static"}
                        options={[
                          { value: "static", label: "Static" },
                          { value: "variable", label: "Variable" },
                        ]}
                        onChange={(value) =>
                          onUpdateElement(selectedElement.id, {
                            buttonTextColorMode: value as "static" | "variable",
                          })
                        }
                      />
                      {selectedElement.buttonTextColorMode === "variable" ? (
                        <SelectField
                          label="Text variable"
                          value={selectedElement.buttonTextColorVariableId}
                          placeholder="Select string variable"
                          options={stringVariables.map((variable) => ({
                            value: variable.id,
                            label: variable.name,
                          }))}
                          onChange={(value) =>
                            onUpdateElement(selectedElement.id, {
                              buttonTextColorVariableId: value || undefined,
                            })
                          }
                        />
                      ) : (
                        <TextInput
                          type="color"
                          label="Text color"
                          value={selectedElement.buttonTextColor ?? "#18181b"}
                          onChange={(value) =>
                            onUpdateElement(selectedElement.id, { buttonTextColor: value })
                          }
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Position & size */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <TextInput
                  type="number"
                  label="X"
                  value={String(Math.round(selectedElement.x))}
                  onChange={(value) => onUpdateElement(selectedElement.id, { x: Number(value || 0) })}
                />
                <TextInput
                  type="number"
                  label="Y"
                  value={String(Math.round(selectedElement.y))}
                  onChange={(value) => onUpdateElement(selectedElement.id, { y: Number(value || 0) })}
                />
                <TextInput
                  type="number"
                  label="Width"
                  value={String(Math.round(selectedElement.width))}
                  onChange={(value) => onUpdateElement(selectedElement.id, { width: Number(value || 0) })}
                />
                <TextInput
                  type="number"
                  label="Height"
                  value={String(Math.round(selectedElement.height))}
                  onChange={(value) => onUpdateElement(selectedElement.id, { height: Number(value || 0) })}
                />
              </div>

              <Toggle
                label="Visible"
                checked={selectedElement.visible}
                onChange={(checked) => onUpdateElement(selectedElement.id, { visible: checked })}
              />

              <SelectField
                label="Group"
                value={selectedElement.groupId}
                placeholder="No group"
                onChange={(value) =>
                  onUpdateElement(selectedElement.id, { groupId: value || undefined })
                }
                options={elements
                  .filter((entry) => entry.type === "group")
                  .map((entry) => ({
                    value: entry.id,
                    label: `${entry.name} (${entry.type})`,
                  }))}
              />

              {/* Actions row */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  paddingTop: 4,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  className="btn btn-sm"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => onBringToFront(selectedElement.id)}
                >
                  Front
                </button>
                <button
                  className="btn btn-sm"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => onSendToBack(selectedElement.id)}
                >
                  Back
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => onDeleteElement(selectedElement.id)}
                >
                  Delete
                </button>
              </div>
            </section>

            {/* Divider */}
            <div style={{ height: 1, background: "var(--border)", margin: "0 -16px" }} />

            {/* Logic section */}
            <LogicEditor
              element={selectedElement}
              elements={elements}
              variables={variables}
              onAddTrigger={(type) => onAddTrigger(selectedElement.id, type)}
              onUpdateTrigger={(triggerId, patch) =>
                onUpdateTrigger(selectedElement.id, triggerId, patch)
              }
              onDeleteTrigger={(triggerId) => onDeleteTrigger(selectedElement.id, triggerId)}
              onAddAction={(triggerId, branch) => onAddAction(selectedElement.id, triggerId, branch)}
              onUpdateAction={(triggerId, actionId, patch, branch) =>
                onUpdateAction(selectedElement.id, triggerId, actionId, patch, branch)
              }
              onDeleteAction={(triggerId, actionId, branch) =>
                onDeleteAction(selectedElement.id, triggerId, actionId, branch)
              }
              onAddCondition={(triggerId) => onAddCondition(selectedElement.id, triggerId)}
              onUpdateCondition={(triggerId, conditionId, patch) =>
                onUpdateCondition(selectedElement.id, triggerId, conditionId, patch)
              }
              onDeleteCondition={(triggerId, conditionId) =>
                onDeleteCondition(selectedElement.id, triggerId, conditionId)
              }
            />
          </div>
        )}
      </div>
    </aside>
  );
}
