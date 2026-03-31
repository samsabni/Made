import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogicEditor } from "./LogicEditor";
import { SelectField, TextInput, Toggle } from "./FormControls";
import type {
  CanvasElementModel,
  Condition,
  EditorMode,
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
  mode: EditorMode;
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

interface InspectorSectionProps {
  sectionKey: InspectorSectionKey;
  title: string;
  description: string;
  summary?: string;
  isOpen: boolean;
  onToggle: (sectionKey: InspectorSectionKey, isOpen: boolean) => void;
  children: ReactNode;
}

type InspectorSectionKey =
  | "content"
  | "placement"
  | "logic";

type InspectorSectionState = Record<InspectorSectionKey, boolean>;

const DEFAULT_INSPECTOR_SECTION_STATE: InspectorSectionState = {
  content: true,
  placement: true,
  logic: false,
};
const DEFAULT_INSPECTOR_WIDTH = 276;
const MIN_INSPECTOR_WIDTH = 252;
const MAX_INSPECTOR_WIDTH = 520;

function InspectorSection({
  sectionKey,
  title,
  description,
  summary,
  isOpen,
  onToggle,
  children,
}: InspectorSectionProps) {
  return (
    <details
      className="inspector-section"
      open={isOpen}
      onToggle={(event) => {
        const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
        onToggle(sectionKey, nextOpen);
      }}
    >
      <summary className="inspector-section-toggle">
        <div className="inspector-section-copy">
          <span className="inspector-section-title">{title}</span>
          <span className="inspector-section-description">{description}</span>
          {summary ? <span className="inspector-section-summary">{summary}</span> : null}
        </div>
        <span className="inspector-section-chevron" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <div className="inspector-section-body">{children}</div>
    </details>
  );
}

export function RightInspectorPanel(props: RightInspectorPanelProps) {
  const {
    panelState,
    mode,
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
  const selectedGroupMemberCount =
    selectedElement?.type === "group"
      ? elements.filter((element) => element.groupId === selectedElement.id).length
      : 0;
  const groupUsesAutoSizing =
    selectedElement?.type === "group" && selectedGroupMemberCount > 0;
  const [sectionState, setSectionState] = useState<InspectorSectionState>(
    DEFAULT_INSPECTOR_SECTION_STATE,
  );
  const [panelWidth, setPanelWidth] = useState(DEFAULT_INSPECTOR_WIDTH);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem("madegame-inspector-sections");
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Partial<InspectorSectionState>;
      setSectionState({
        ...DEFAULT_INSPECTOR_SECTION_STATE,
        ...parsed,
      });
    } catch {
      setSectionState(DEFAULT_INSPECTOR_SECTION_STATE);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedWidth = Number(window.localStorage.getItem("madegame-inspector-width"));
    if (!Number.isFinite(savedWidth)) {
      return;
    }

    setPanelWidth(Math.min(Math.max(savedWidth, MIN_INSPECTOR_WIDTH), MAX_INSPECTOR_WIDTH));
  }, []);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const nextWidth = Math.min(
        Math.max(resizeState.startWidth + (resizeState.startX - event.clientX), MIN_INSPECTOR_WIDTH),
        MAX_INSPECTOR_WIDTH,
      );
      setPanelWidth(nextWidth);
    }

    function handlePointerUp() {
      if (!resizeStateRef.current) {
        return;
      }

      resizeStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("madegame-inspector-width", String(panelWidth));
  }, [panelWidth]);

  function handleSectionToggle(sectionKey: InspectorSectionKey, isOpen: boolean) {
    setSectionState((current) => {
      const next = {
        ...current,
        [sectionKey]: isOpen,
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem("madegame-inspector-sections", JSON.stringify(next));
      }

      return next;
    });
  }

  function getContentSummary() {
    if (!selectedElement) {
      return "";
    }

    const fontSize = selectedElement.fontSize ?? (selectedElement.type === "text" ? 20 : 14);
    const fontWeight =
      selectedElement.fontWeight ??
      (selectedElement.type === "text" ? "medium" : "semibold");
    const source =
      selectedElement.type === "button"
        ? selectedElement.textSourceMode === "variable"
          ? "variable label"
          : "static label"
        : "static text";

    return `${source} • ${fontSize}px ${fontWeight}`;
  }

  function getPlacementSummary() {
    if (!selectedElement) {
      return "";
    }

    return `x:${Math.round(selectedElement.x)} y:${Math.round(selectedElement.y)} • ${Math.round(selectedElement.width)}×${Math.round(selectedElement.height)} • ${selectedElement.visible ? "visible" : "hidden"}`;
  }

  function getLogicSummary() {
    if (!selectedElement) {
      return "";
    }

    const triggerCount = selectedElement.triggers.length;
    return triggerCount === 0
      ? "No triggers"
      : `${triggerCount} ${triggerCount === 1 ? "trigger" : "triggers"}`;
  }

  if (!panelState.open) {
    return null;
  }

  return (
    <aside className="side-panel right side-panel-resizable" style={{ width: panelWidth }}>
      <button
        type="button"
        className="side-panel-resize-handle"
        aria-label="Resize inspector"
        title="Drag to resize"
        onPointerDown={(event) => {
          resizeStateRef.current = {
            startX: event.clientX,
            startWidth: panelWidth,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
      />
      <div className="side-panel-header">
        <span className="side-panel-title">Inspector</span>
        <button className="side-panel-close" onClick={onClose} aria-label="Close inspector">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="side-panel-body">
        {mode === "preview" ? (
          <div className="empty-state" style={{ marginTop: 48 }}>
            Preview is running.<br />Exit preview to edit elements and logic.
          </div>
        ) : !selectedElement ? (
          <div className="empty-state" style={{ marginTop: 48 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8, opacity: 0.4 }}>
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
            </svg>
            Click an element on the canvas to inspect and edit it.
          </div>
        ) : (
          <div className="inspector-stack">
            <div className="inspector-header-card">
              <div className="inspector-element-name">{selectedElement.name}</div>
              <div className="inspector-element-meta">
                <span className="inspector-type-badge">{selectedElement.type}</span>
                <span className="inspector-element-subtitle">
                  Edit content, layout, and behavior for this element.
                </span>
              </div>
            </div>

            <InspectorSection
              sectionKey="content"
              title="Content"
              description="Text, typography, and button styling"
              summary={getContentSummary()}
              isOpen={sectionState.content}
              onToggle={handleSectionToggle}
            >
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
                  <div className="inspector-grid-2">
                    <TextInput
                      type="number"
                      label="Font size"
                      value={String(
                        selectedElement.fontSize ?? (selectedElement.type === "text" ? 20 : 14),
                      )}
                      onChange={(value) =>
                        onUpdateElement(selectedElement.id, {
                          fontSize: Number(
                            value || (selectedElement.type === "text" ? 20 : 14),
                          ),
                        })
                      }
                    />
                    <SelectField
                      label="Weight"
                      value={
                        selectedElement.fontWeight ??
                        (selectedElement.type === "text" ? "medium" : "semibold")
                      }
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
                    </>
                  )}
                </>
              )}

              {selectedElement.type === "button" && (
                <div className="inspector-grid-2">
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
                          onUpdateElement(selectedElement.id, {
                            buttonBackgroundColor: value,
                          })
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
                          onUpdateElement(selectedElement.id, {
                            buttonTextColor: value,
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              )}
            </InspectorSection>

            <InspectorSection
              sectionKey="placement"
              title="Placement"
              description="Position, size, visibility, grouping, and layer order"
              summary={getPlacementSummary()}
              isOpen={sectionState.placement}
              onToggle={handleSectionToggle}
            >
              <div className="inspector-metrics">
                <label className="inspector-metric">
                  <span className="inspector-metric-label">X</span>
                  <input
                    className="field-input inspector-metric-input"
                    type="number"
                    value={String(Math.round(selectedElement.x))}
                    onChange={(event) =>
                      onUpdateElement(selectedElement.id, {
                        x: Number(event.target.value || 0),
                      })
                    }
                  />
                </label>
                <label className="inspector-metric">
                  <span className="inspector-metric-label">Y</span>
                  <input
                    className="field-input inspector-metric-input"
                    type="number"
                    value={String(Math.round(selectedElement.y))}
                    onChange={(event) =>
                      onUpdateElement(selectedElement.id, {
                        y: Number(event.target.value || 0),
                      })
                    }
                  />
                </label>
                <label className="inspector-metric">
                  <span className="inspector-metric-label">W</span>
                  <input
                    className="field-input inspector-metric-input"
                    type="number"
                    value={String(Math.round(selectedElement.width))}
                    disabled={groupUsesAutoSizing}
                    onChange={(event) =>
                      onUpdateElement(selectedElement.id, {
                        width: Number(event.target.value || 0),
                      })
                    }
                  />
                </label>
                <label className="inspector-metric">
                  <span className="inspector-metric-label">H</span>
                  <input
                    className="field-input inspector-metric-input"
                    type="number"
                    value={String(Math.round(selectedElement.height))}
                    disabled={groupUsesAutoSizing}
                    onChange={(event) =>
                      onUpdateElement(selectedElement.id, {
                        height: Number(event.target.value || 0),
                      })
                    }
                  />
                </label>
              </div>

              {groupUsesAutoSizing ? (
                <div className="field-help">
                  Group size follows its members and updates automatically.
                </div>
              ) : null}

              <Toggle
                label="Visible"
                checked={selectedElement.visible}
                onChange={(checked) =>
                  onUpdateElement(selectedElement.id, { visible: checked })
                }
              />
              {selectedElement.type !== "group" ? (
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
              ) : null}

              <div className="inspector-actions">
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
            </InspectorSection>

            <InspectorSection
              sectionKey="logic"
              title="Logic"
              description="Triggers, conditions, and actions"
              summary={getLogicSummary()}
              isOpen={sectionState.logic}
              onToggle={handleSectionToggle}
            >
              <LogicEditor
                element={selectedElement}
                elements={elements}
                variables={variables}
                onAddTrigger={(type) => onAddTrigger(selectedElement.id, type)}
                onUpdateTrigger={(triggerId, patch) =>
                  onUpdateTrigger(selectedElement.id, triggerId, patch)
                }
                onDeleteTrigger={(triggerId) => onDeleteTrigger(selectedElement.id, triggerId)}
                onAddAction={(triggerId, branch) =>
                  onAddAction(selectedElement.id, triggerId, branch)
                }
                onUpdateAction={(triggerId, actionId, patch, branch) =>
                  onUpdateAction(
                    selectedElement.id,
                    triggerId,
                    actionId,
                    patch,
                    branch,
                  )
                }
                onDeleteAction={(triggerId, actionId, branch) =>
                  onDeleteAction(selectedElement.id, triggerId, actionId, branch)
                }
                onAddCondition={(triggerId) => onAddCondition(selectedElement.id, triggerId)}
                onUpdateCondition={(triggerId, conditionId, patch) =>
                  onUpdateCondition(
                    selectedElement.id,
                    triggerId,
                    conditionId,
                    patch,
                  )
                }
                onDeleteCondition={(triggerId, conditionId) =>
                  onDeleteCondition(selectedElement.id, triggerId, conditionId)
                }
              />
            </InspectorSection>
          </div>
        )}
      </div>
    </aside>
  );
}
