import { useEffect, useState } from "react";
import { ACTION_LABELS } from "../constants";
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

  if (trigger.hasElse) {
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
  const left = condition.left.trim() || "left value";
  const right = condition.right.trim() || "right value";
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
        <div className="logic-fields-grid">
          <SelectField
            label="Action"
            value={action.type}
            options={Object.entries(ACTION_LABELS).map(([key, label]) => ({
              value: key,
              label,
            }))}
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
            <SelectField
              label="Variable"
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
            <SelectField
              label="Element"
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
            <SelectField
              label="Group"
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
            <TextInput
              label="Value"
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
          No triggers yet.<br />Add one to define behavior.
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
                {trigger.type === "timer" && (
                  <section className="logic-flat-section">
                    <div className="logic-flat-header">
                      <span className="logic-sub-label">Setup</span>
                      <span className="logic-flat-caption">Timer settings</span>
                    </div>
                    <div className="logic-item">
                      <div className="logic-item-stack">
                        <TextInput
                          label="Interval (ms)"
                          type="number"
                          value={String(trigger.timerIntervalMs ?? 1000)}
                          onChange={(value) =>
                            onUpdateTrigger(trigger.id, {
                              timerIntervalMs: Number(value || 1000),
                            })
                          }
                        />
                        <Toggle
                          label="Auto-start"
                          checked={Boolean(trigger.timerAutoStart)}
                          onChange={(checked) =>
                            onUpdateTrigger(trigger.id, { timerAutoStart: checked })
                          }
                        />
                      </div>
                    </div>
                  </section>
                )}

                {trigger.type === "variable_change" && (
                  <section className="logic-flat-section">
                    <div className="logic-flat-header">
                      <span className="logic-sub-label">Setup</span>
                      <span className="logic-flat-caption">Variable listening</span>
                    </div>
                    <div className="logic-item">
                      <div className="logic-item-stack">
                        <SelectField
                          label="Listen mode"
                          value={trigger.variableChangeMode ?? "any"}
                          options={[
                            { value: "any", label: "Any variable change" },
                            { value: "specific", label: "Specific variable" },
                          ]}
                          onChange={(value) => {
                            const parsed = value as "any" | "specific";
                            if (!parsed) return;
                            onUpdateTrigger(trigger.id, { variableChangeMode: parsed });
                          }}
                        />
                        {trigger.variableChangeMode === "specific" && (
                          <SelectField
                            label="Variable"
                            value={trigger.targetVariableId}
                            options={variables.map((variable) => ({
                              value: variable.id,
                              label: `${variable.name} (${variable.type})`,
                            }))}
                            onChange={(value) =>
                              onUpdateTrigger(trigger.id, { targetVariableId: value })
                            }
                          />
                        )}
                      </div>
                    </div>
                  </section>
                )}

                <section className="logic-flat-section">
                  <div className="logic-flat-header">
                    <div className="logic-flat-copy">
                      <span className="logic-sub-label">When</span>
                      <span className="logic-flat-caption">
                        {trigger.conditions.length === 0
                          ? "Always runs"
                          : `${trigger.conditions.length} ${trigger.conditions.length === 1 ? "condition" : "conditions"}`}
                      </span>
                    </div>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => onAddCondition(trigger.id)}
                    >
                      + Add IF
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
                            <div className="logic-fields-grid">
                            {index > 0 && (
                              <SelectField
                                label="Join"
                                value={condition.join ?? "and"}
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
                            <TextInput
                              label="Left"
                              value={condition.left}
                              onChange={(value) =>
                                onUpdateCondition(trigger.id, condition.id, { left: value })
                              }
                            />
                            <SelectField
                              label="Operator"
                              value={condition.operator}
                              options={[
                                { value: "equals", label: "Equals" },
                                { value: "not_equals", label: "Not equals" },
                                { value: "greater_than", label: "Greater than" },
                                { value: "less_than", label: "Less than" },
                                { value: "contains", label: "Contains" },
                              ]}
                              onChange={(value) =>
                                onUpdateCondition(trigger.id, condition.id, {
                                  operator: value as Condition["operator"],
                                })
                              }
                            />
                            <TextInput
                              label="Right"
                              value={condition.right}
                              onChange={(value) =>
                                onUpdateCondition(trigger.id, condition.id, { right: value })
                              }
                            />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="logic-empty-inline">
                      No conditions. This trigger will run whenever it fires.
                    </div>
                  )}
                </section>

                <section className="logic-flat-section">
                  <div className="logic-flat-header">
                    <div className="logic-flat-copy">
                      <span className="logic-sub-label">Then</span>
                      <span className="logic-flat-caption">
                        {trigger.actions.length === 0
                          ? "No actions yet"
                          : `${trigger.actions.length} ${trigger.actions.length === 1 ? "action" : "actions"}`}
                      </span>
                    </div>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => onAddAction(trigger.id, "then")}
                    >
                      + Add action
                    </button>
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
                    <div className="logic-empty-inline">No actions yet.</div>
                  )}
                </section>

                <section className="logic-flat-section">
                  <div className="logic-flat-header">
                    <div className="logic-flat-copy">
                      <span className="logic-sub-label">Else</span>
                      <span className="logic-flat-caption">
                        {trigger.hasElse
                          ? `${trigger.elseActions?.length ?? 0} ${trigger.elseActions?.length === 1 ? "action" : "actions"}`
                          : "Disabled"}
                      </span>
                    </div>
                    <Toggle
                      label="Enable ELSE"
                      checked={Boolean(trigger.hasElse)}
                      onChange={(checked) =>
                        onUpdateTrigger(trigger.id, {
                          hasElse: checked,
                          elseActions: checked ? trigger.elseActions ?? [] : [],
                        })
                      }
                    />
                  </div>

                  {trigger.hasElse ? (
                    <>
                      <div className="logic-flat-toolbar">
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => onAddAction(trigger.id, "else")}
                        >
                          + Add else action
                        </button>
                      </div>
                      {(trigger.elseActions?.length ?? 0) > 0 ? (
                        <div className="logic-list">
                          {(trigger.elseActions ?? []).map((action) => (
                            <div key={action.id} className="logic-item">
                              <div className="logic-item-stack">
                                {renderActionFields(trigger, action, "else")}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="logic-empty-inline">Else branch is enabled, but empty.</div>
                      )}
                    </>
                  ) : (
                    <div className="logic-empty-inline">Else branch is disabled.</div>
                  )}
                </section>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
