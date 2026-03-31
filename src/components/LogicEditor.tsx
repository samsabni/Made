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

  function renderActionList(
    trigger: TriggerDefinition,
    actions: TriggerAction[],
    branch: "then" | "else",
    title: string,
    addLabel: string,
  ) {
    return (
      <div>
        <div className="logic-section-header">
          <span className="logic-sub-label">{title}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => onAddAction(trigger.id, branch)}>
            {addLabel}
          </button>
        </div>
        {actions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {actions.map((action) => (
              <div key={action.id} className="logic-item">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                        onUpdateAction(
                          trigger.id,
                          action.id,
                          { targetVariableId: value },
                          branch,
                        )
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
                        onUpdateAction(
                          trigger.id,
                          action.id,
                          { targetElementId: value },
                          branch,
                        )
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
                        onUpdateAction(
                          trigger.id,
                          action.id,
                          { targetGroupId: value },
                          branch,
                        )
                      }
                    />
                  )}
                  {shouldShowActionValueInput(action) ? (
                    <TextInput
                      label="Value"
                      value={action.value ?? ""}
                      onChange={(value) =>
                        onUpdateAction(trigger.id, action.id, { value }, branch)
                      }
                    />
                  ) : null}
                  <button
                    className="btn btn-danger btn-xs"
                    style={{ alignSelf: "flex-start", marginTop: 2 }}
                    onClick={() => onDeleteAction(trigger.id, action.id, branch)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {element.triggers.map((trigger) => (
            <div key={trigger.id} className="logic-trigger-block">
              {/* Trigger header */}
              <div className="logic-trigger-header">
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 13, lineHeight: 1 }}>
                    {TRIGGER_ICONS[trigger.type]}
                  </span>
                  <span className="logic-trigger-label">
                    {TRIGGER_OPTIONS.find((opt) => opt.key === trigger.type)?.label}
                  </span>
                </div>
                <button
                  className="btn btn-danger btn-xs"
                  onClick={() => onDeleteTrigger(trigger.id)}
                >
                  Remove
                </button>
              </div>

              <div className="logic-trigger-body">
                {/* Timer config */}
                {trigger.type === "timer" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <TextInput
                      label="Interval (ms)"
                      type="number"
                      value={String(trigger.timerIntervalMs ?? 1000)}
                      onChange={(value) =>
                        onUpdateTrigger(trigger.id, { timerIntervalMs: Number(value || 1000) })
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
                )}

                {/* Variable change config */}
                {trigger.type === "variable_change" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                )}

                {/* Conditions */}
                <div>
                  <div className="logic-section-header">
                    <span className="logic-sub-label">Conditions</span>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => onAddCondition(trigger.id)}
                    >
                      + Add IF
                    </button>
                  </div>
                  {trigger.conditions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {trigger.conditions.map((condition, index) => (
                        <div key={condition.id} className="logic-item">
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                            <button
                              className="btn btn-danger btn-xs"
                              style={{ alignSelf: "flex-start", marginTop: 2 }}
                              onClick={() => onDeleteCondition(trigger.id, condition.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {renderActionList(trigger, trigger.actions, "then", "Actions", "+ Add action")}

                <div>
                  <div className="logic-section-header">
                    <span className="logic-sub-label">Else</span>
                    <Toggle
                      label="Enable ELSE branch"
                      checked={Boolean(trigger.hasElse)}
                      onChange={(checked) =>
                        onUpdateTrigger(trigger.id, {
                          hasElse: checked,
                          elseActions: checked ? trigger.elseActions ?? [] : [],
                        })
                      }
                    />
                  </div>
                  {trigger.hasElse
                    ? renderActionList(
                        trigger,
                        trigger.elseActions ?? [],
                        "else",
                        "Else actions",
                        "+ Add else action",
                      )
                    : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
