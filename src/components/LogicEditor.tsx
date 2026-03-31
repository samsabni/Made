import { useEffect, useState } from "react";
import { ACTION_LABELS, ACTION_OPTIONS } from "../constants";
import type {
  CanvasElementModel,
  Condition,
  GameVariable,
  TriggerAction,
  TriggerDefinition,
  TriggerType,
} from "../types";
import {
  actionTargetsElement,
  actionTargetsGroup,
  actionTargetsVariable,
  shouldShowActionValueInput,
} from "../utils/logic";
import { SelectField, TextInput, Toggle } from "./FormControls";

interface LogicEditorProps {
  element: CanvasElementModel;
  elements: CanvasElementModel[];
  variables: GameVariable[];
  onAddTrigger: (type: TriggerType) => void;
  onUpdateTrigger: (triggerId: string, patch: Partial<TriggerDefinition>) => void;
  onDeleteTrigger: (triggerId: string) => void;
  onAddAction: (triggerId: string, branch?: "then" | "else") => void;
  onUpdateAction: (
    triggerId: string,
    actionId: string,
    patch: Partial<TriggerAction>,
    branch?: "then" | "else",
  ) => void;
  onDeleteAction: (triggerId: string, actionId: string, branch?: "then" | "else") => void;
  onAddCondition: (triggerId: string) => void;
  onUpdateCondition: (triggerId: string, conditionId: string, patch: Partial<Condition>) => void;
  onDeleteCondition: (triggerId: string, conditionId: string) => void;
}

const TRIGGER_OPTIONS: Array<{ key: TriggerType; label: string }> = [
  { key: "click", label: "On click" },
  { key: "timer", label: "On timer" },
  { key: "variable_change", label: "On variable change" },
];

const TRIGGER_ICONS: Record<TriggerType, string> = {
  click: "↗",
  timer: "⏱",
  variable_change: "⟳",
};

type LogicDisclosureState = Record<string, boolean>;

function getTriggerSummary(trigger: TriggerDefinition) {
  const conditionCount = trigger.conditions.length;
  const actionCount = trigger.actions.length;
  const elseCount = trigger.elseActions?.length ?? 0;

  const parts = [
    `${conditionCount} ${conditionCount === 1 ? "condition" : "conditions"}`,
    `${actionCount} ${actionCount === 1 ? "action" : "actions"}`,
  ];

  if (elseCount > 0) {
    parts.push(`${elseCount} else`);
  }

  return parts.join(" • ");
}

function getOperatorLabel(operator: Condition["operator"]) {
  switch (operator) {
    case "equals":
      return "equals";
    case "not_equals":
      return "does not equal";
    case "greater_than":
      return "is greater than";
    case "less_than":
      return "is less than";
    case "contains":
      return "contains";
    default:
      return operator;
  }
}

function getVariableName(variableId: string | undefined, variables: GameVariable[]) {
  if (!variableId) {
    return "nothing selected";
  }

  return variables.find((variable) => variable.id === variableId)?.name ?? "missing variable";
}

function getElementName(elementId: string | undefined, elements: CanvasElementModel[]) {
  if (!elementId) {
    return "nothing selected";
  }

  return elements.find((element) => element.id === elementId)?.name ?? "missing element";
}

function getGroupName(groupId: string | undefined, elements: CanvasElementModel[]) {
  if (!groupId) {
    return "nothing selected";
  }

  return (
    elements.find((element) => element.id === groupId && element.type === "group")?.name ??
    "missing group"
  );
}

function getConditionSentence(condition: Condition, index: number) {
  const joinLabel = index > 0 ? `${(condition.join ?? "and").toUpperCase()} ` : "";
  const left = condition.leftVariableId ? "selected variable" : condition.left.trim() || "variable";
  const right =
    condition.rightMode === "variable"
      ? "selected variable"
      : condition.right.trim() || "value";
  return `${joinLabel}${left} ${getOperatorLabel(condition.operator)} ${right}`;
}

function getActionSentence(
  action: TriggerAction,
  elements: CanvasElementModel[],
  variables: GameVariable[],
) {
  switch (action.type) {
    case "set_variable":
      return `Set ${getVariableName(action.targetVariableId, variables)} to ${action.value || "value"}`;
    case "add_number":
      return `Add ${action.value || "value"} to ${getVariableName(action.targetVariableId, variables)}`;
    case "subtract_number":
      return `Subtract ${action.value || "value"} from ${getVariableName(action.targetVariableId, variables)}`;
    case "toggle_boolean":
      return `Toggle ${getVariableName(action.targetVariableId, variables)}`;
    case "append_string_array":
      return `Add ${action.value || "text"} to ${getVariableName(action.targetVariableId, variables)}`;
    case "remove_string_array":
      return `Remove ${action.value || "text"} from ${getVariableName(action.targetVariableId, variables)}`;
    case "change_text":
      return `Change ${getElementName(action.targetElementId, elements)} text to ${action.value || "value"}`;
    case "show_element":
      return `Show ${getElementName(action.targetElementId, elements)}`;
    case "hide_element":
      return `Hide ${getElementName(action.targetElementId, elements)}`;
    case "show_group":
      return `Show ${getGroupName(action.targetGroupId, elements)}`;
    case "hide_group":
      return `Hide ${getGroupName(action.targetGroupId, elements)}`;
    case "bring_to_front":
      return `Bring ${getElementName(action.targetElementId, elements)} to front`;
    case "send_to_back":
      return `Send ${getElementName(action.targetElementId, elements)} to back`;
    case "start_timer":
      return `Start timer on ${getElementName(action.targetElementId, elements)}`;
    case "stop_timer":
      return `Stop timer on ${getElementName(action.targetElementId, elements)}`;
    case "pause_timer":
      return `Pause timer on ${getElementName(action.targetElementId, elements)}`;
    case "resume_timer":
      return `Resume timer on ${getElementName(action.targetElementId, elements)}`;
    default:
      return ACTION_LABELS[action.type];
  }
}

function InlineSelect(props: {
  value?: string;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return <SelectField label="" className={`logic-inline-field ${props.className ?? ""}`} {...props} />;
}

function InlineTextInput(props: {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "color";
  placeholder?: string;
  className?: string;
}) {
  return <TextInput label="" className={`logic-inline-field ${props.className ?? ""}`} {...props} />;
}

function getVariableOptions(variables: GameVariable[]) {
  return variables.map((variable) => ({
    value: variable.id,
    label: `${variable.name} (${variable.type})`,
  }));
}

export function LogicEditor(props: LogicEditorProps) {
  const {
    element,
    elements,
    variables,
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
  const [disclosureState, setDisclosureState] = useState<LogicDisclosureState>({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem("madegame-logic-disclosures");
    if (!saved) {
      return;
    }

    try {
      setDisclosureState(JSON.parse(saved) as LogicDisclosureState);
    } catch {
      setDisclosureState({});
    }
  }, []);

  function getDisclosureKey(triggerId: string) {
    return `${element.id}:${triggerId}:trigger`;
  }

  function isTriggerOpen(triggerId: string) {
    return disclosureState[getDisclosureKey(triggerId)] ?? true;
  }

  function setTriggerOpen(triggerId: string, isOpen: boolean) {
    setDisclosureState((current) => {
      const next = {
        ...current,
        [getDisclosureKey(triggerId)]: isOpen,
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem("madegame-logic-disclosures", JSON.stringify(next));
      }

      return next;
    });
  }

  function renderActionFields(
    trigger: TriggerDefinition,
    action: TriggerAction,
    branch: "then" | "else",
  ) {
    return (
      <>
        <div className="logic-row-summary">
          <span className="logic-row-kicker">{branch === "then" ? "Then" : "Else"}</span>
          <span className="logic-row-sentence">
            {getActionSentence(action, elements, variables)}
          </span>
          <button
            className="btn btn-danger btn-xs"
            onClick={() => onDeleteAction(trigger.id, action.id, branch)}
          >
            Remove
          </button>
        </div>
        <div className="logic-sentence-editor">
          <span className="logic-sentence-prefix">{branch === "then" ? "Then" : "Otherwise"}</span>
          <InlineSelect
            value={action.type}
            options={ACTION_OPTIONS}
            onChange={(value) =>
              onUpdateAction(
                trigger.id,
                action.id,
                { type: value as TriggerAction["type"] },
                branch,
              )
            }
          />
          {actionTargetsVariable(action) && (
            <InlineSelect
              value={action.targetVariableId}
              options={variables.map((variable) => ({
                value: variable.id,
                label: `${variable.name} (${variable.type})`,
              }))}
              onChange={(value) =>
                onUpdateAction(trigger.id, action.id, { targetVariableId: value }, branch)
              }
            />
          )}
          {actionTargetsElement(action) && (
            <InlineSelect
              value={action.targetElementId}
              options={elements.map((entry) => ({
                value: entry.id,
                label: `${entry.name} (${entry.type})`,
              }))}
              onChange={(value) =>
                onUpdateAction(trigger.id, action.id, { targetElementId: value }, branch)
              }
            />
          )}
          {actionTargetsGroup(action) && (
            <InlineSelect
              value={action.targetGroupId}
              options={elements
                .filter((entry) => entry.type === "group")
                .map((entry) => ({
                  value: entry.id,
                  label: `${entry.name} (${entry.type})`,
                }))}
              onChange={(value) =>
                onUpdateAction(trigger.id, action.id, { targetGroupId: value }, branch)
              }
            />
          )}
          {shouldShowActionValueInput(action) ? (
            <InlineTextInput
              value={action.value ?? ""}
              onChange={(value) => onUpdateAction(trigger.id, action.id, { value }, branch)}
            />
          ) : null}
        </div>
      </>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="logic-section-header">
        <span className="section-title">Logic</span>
        <div style={{ width: 148 }}>
          <SelectField
            label=""
            placeholder="+ Add trigger"
            options={TRIGGER_OPTIONS.map((option) => ({ value: option.key, label: option.label }))}
            onChange={(value) => value && onAddTrigger(value as TriggerType)}
          />
        </div>
      </div>

      {element.triggers.length === 0 ? (
        <div className="empty-state">
          No triggers yet.<br />Add a trigger to decide when this element should react.
        </div>
      ) : (
        <div className="logic-list">
          {element.triggers.map((trigger) => (
            <details
              key={trigger.id}
              className="logic-trigger-block"
              open={isTriggerOpen(trigger.id)}
              onToggle={(event) =>
                setTriggerOpen(trigger.id, (event.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary className="logic-trigger-header">
                <div className="logic-trigger-main">
                  <div className="logic-trigger-title-row">
                    <span className="logic-trigger-icon">{TRIGGER_ICONS[trigger.type]}</span>
                    <span className="logic-trigger-label">
                      {TRIGGER_OPTIONS.find((option) => option.key === trigger.type)?.label}
                    </span>
                  </div>
                  <div className="logic-trigger-summary">{getTriggerSummary(trigger)}</div>
                </div>
                <div className="logic-trigger-controls">
                  <button
                    type="button"
                    className="btn btn-danger btn-xs"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDeleteTrigger(trigger.id);
                    }}
                  >
                    Remove
                  </button>
                  <span className="logic-trigger-chevron" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </div>
              </summary>

              <div className="logic-trigger-body">
                <section className="logic-flat-section">
                  <div className="logic-flat-header">
                    <div className="logic-flat-copy">
                      <span className="logic-sub-label">When</span>
                      <span className="logic-flat-caption">How this trigger starts</span>
                    </div>
                  </div>
                  <div className="logic-item">
                    <div className="logic-item-stack">
                      {trigger.type === "click" && (
                        <div className="logic-sentence-editor">
                          <span className="logic-sentence-prefix">When</span>
                          <span className="logic-sentence-text">this element is clicked</span>
                        </div>
                      )}

                      {trigger.type === "timer" && (
                        <>
                          <div className="logic-sentence-editor">
                            <span className="logic-sentence-prefix">When</span>
                            <span className="logic-sentence-text">the timer runs every</span>
                            <InlineTextInput
                              type="number"
                              value={String(trigger.timerIntervalMs ?? 1000)}
                              className="logic-inline-field-sm"
                              onChange={(value) =>
                                onUpdateTrigger(trigger.id, {
                                  timerIntervalMs: Number(value || 1000),
                                })
                              }
                            />
                            <span className="logic-sentence-text">ms</span>
                          </div>
                          <div className="logic-sentence-meta">
                            <Toggle
                              label="Auto-start"
                              checked={Boolean(trigger.timerAutoStart)}
                              onChange={(checked) =>
                                onUpdateTrigger(trigger.id, { timerAutoStart: checked })
                              }
                            />
                          </div>
                        </>
                      )}

                      {trigger.type === "variable_change" && (
                        <div className="logic-sentence-editor">
                          <span className="logic-sentence-prefix">When</span>
                          <InlineSelect
                            value={trigger.variableChangeMode ?? "any"}
                            className="logic-inline-field-md"
                            options={[
                              { value: "any", label: "any variable" },
                              { value: "specific", label: "a specific variable" },
                            ]}
                            onChange={(value) => {
                              const parsed = value as "any" | "specific";
                              if (!parsed) return;
                              onUpdateTrigger(trigger.id, { variableChangeMode: parsed });
                            }}
                          />
                          {trigger.variableChangeMode === "specific" ? (
                            <>
                              <span className="logic-sentence-text">changes:</span>
                              <InlineSelect
                                value={trigger.targetVariableId}
                                className="logic-inline-field-lg"
                                options={variables.map((variable) => ({
                                  value: variable.id,
                                  label: `${variable.name} (${variable.type})`,
                                }))}
                                onChange={(value) =>
                                  onUpdateTrigger(trigger.id, { targetVariableId: value })
                                }
                              />
                            </>
                          ) : (
                            <span className="logic-sentence-text">changes</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="logic-flat-section">
                  <div className="logic-flat-header">
                    <div className="logic-flat-copy">
                      <span className="logic-sub-label">If</span>
                      <span className="logic-flat-caption">
                        {trigger.conditions.length === 0
                          ? "Runs every time until you add a condition"
                          : `${trigger.conditions.length} ${trigger.conditions.length === 1 ? "condition" : "conditions"}`}
                      </span>
                    </div>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => onAddCondition(trigger.id)}
                    >
                      + Add condition
                    </button>
                  </div>

                  {trigger.conditions.length > 0 ? (
                    <div className="logic-list">
                      {trigger.conditions.map((condition, index) => (
                        <div key={condition.id} className="logic-item">
                          <div className="logic-item-stack">
                            <div className="logic-row-summary">
                              <span className="logic-row-kicker">If</span>
                              <span className="logic-row-sentence">
                                {getConditionSentence(condition, index)}
                              </span>
                              <button
                                className="btn btn-danger btn-xs"
                                onClick={() => onDeleteCondition(trigger.id, condition.id)}
                              >
                                Remove
                              </button>
                            </div>
                            <div className="logic-sentence-editor">
                              {index > 0 && (
                                <InlineSelect
                                  value={condition.join ?? "and"}
                                  className="logic-inline-field-sm"
                                  options={[
                                    { value: "and", label: "AND" },
                                    { value: "or", label: "OR" },
                                  ]}
                                  onChange={(value) =>
                                    onUpdateCondition(trigger.id, condition.id, {
                                      join: value as "and" | "or",
                                    })
                                  }
                                />
                              )}
                              <InlineSelect
                                value={condition.leftVariableId}
                                className="logic-inline-field-lg"
                                options={getVariableOptions(variables)}
                                onChange={(value) =>
                                  onUpdateCondition(trigger.id, condition.id, {
                                    leftVariableId: value,
                                  })
                                }
                              />
                              <InlineSelect
                                value={condition.operator}
                                className="logic-inline-field-md"
                                options={[
                                  { value: "equals", label: "equals" },
                                  { value: "not_equals", label: "does not equal" },
                                  { value: "greater_than", label: "is greater than" },
                                  { value: "less_than", label: "is less than" },
                                  { value: "contains", label: "contains" },
                                ]}
                                onChange={(value) =>
                                  onUpdateCondition(trigger.id, condition.id, {
                                    operator: value as Condition["operator"],
                                  })
                                }
                              />
                              <InlineSelect
                                value={condition.rightMode ?? "value"}
                                className="logic-inline-field-sm"
                                options={[
                                  { value: "value", label: "Value" },
                                  { value: "variable", label: "Variable" },
                                ]}
                                onChange={(value) =>
                                  onUpdateCondition(trigger.id, condition.id, {
                                    rightMode: value as "value" | "variable",
                                    rightVariableId:
                                      value === "variable" ? condition.rightVariableId : undefined,
                                  })
                                }
                              />
                              {condition.rightMode === "variable" ? (
                                <InlineSelect
                                  value={condition.rightVariableId}
                                  className="logic-inline-field-lg"
                                  options={getVariableOptions(variables)}
                                  onChange={(value) =>
                                    onUpdateCondition(trigger.id, condition.id, {
                                      rightVariableId: value,
                                    })
                                  }
                                />
                              ) : (
                                <InlineTextInput
                                  value={condition.right}
                                  className="logic-inline-field-lg"
                                  placeholder="value"
                                  onChange={(value) =>
                                    onUpdateCondition(trigger.id, condition.id, { right: value })
                                  }
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="logic-empty-inline">
                      No conditions yet. Add one if this should only run in specific cases.
                    </div>
                  )}
                </section>

                <section className="logic-flat-section">
                  <div className="logic-flat-header">
                    <div className="logic-flat-copy">
                      <span className="logic-sub-label">Then</span>
                      <span className="logic-flat-caption">
                        {trigger.actions.length === 0
                          ? "Choose what happens next"
                          : `${trigger.actions.length} ${trigger.actions.length === 1 ? "action" : "actions"}`}
                      </span>
                    </div>
                    <div className="logic-inline-actions">
                      {!(trigger.elseActions?.length ?? 0) && (
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => onAddAction(trigger.id, "else")}
                        >
                          + Add otherwise action
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => onAddAction(trigger.id, "then")}
                      >
                        + Add action
                      </button>
                    </div>
                  </div>

                  {trigger.actions.length > 0 ? (
                    <div className="logic-list">
                      {trigger.actions.map((action) => (
                        <div key={action.id} className="logic-item">
                          <div className="logic-item-stack">
                            {renderActionFields(trigger, action, "then")}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="logic-empty-inline">
                      No actions yet. Add an action to choose what happens next.
                    </div>
                  )}
                </section>

                {(trigger.elseActions?.length ?? 0) > 0 && (
                  <section className="logic-flat-section">
                    <div className="logic-flat-header">
                      <div className="logic-flat-copy">
                        <span className="logic-sub-label">Otherwise</span>
                        <span className="logic-flat-caption">
                          {(trigger.elseActions?.length ?? 0)}{" "}
                          {(trigger.elseActions?.length ?? 0) === 1 ? "action" : "actions"}
                        </span>
                      </div>
                      <div className="logic-flat-toolbar">
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => onAddAction(trigger.id, "else")}
                        >
                          + Add action
                        </button>
                      </div>
                    </div>

                    <div className="logic-list">
                      {(trigger.elseActions ?? []).map((action) => (
                        <div key={action.id} className="logic-item">
                          <div className="logic-item-stack">
                            {renderActionFields(trigger, action, "else")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
