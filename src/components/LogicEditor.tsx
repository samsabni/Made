import { Button } from "@heroui/react";
import { ACTION_LABELS } from "../constants";
import type {
  CanvasElementModel,
  Condition,
  GameVariable,
  TriggerAction,
  TriggerDefinition,
  TriggerType,
} from "../types";
import { actionTargetsElement, actionTargetsGroup, actionTargetsVariable } from "../utils/logic";
import { SelectField, TextInput, Toggle } from "./FormControls";

interface LogicEditorProps {
  element: CanvasElementModel;
  elements: CanvasElementModel[];
  variables: GameVariable[];
  onAddTrigger: (type: TriggerType) => void;
  onUpdateTrigger: (triggerId: string, patch: Partial<TriggerDefinition>) => void;
  onDeleteTrigger: (triggerId: string) => void;
  onAddAction: (triggerId: string) => void;
  onUpdateAction: (triggerId: string, actionId: string, patch: Partial<TriggerAction>) => void;
  onDeleteAction: (triggerId: string, actionId: string) => void;
  onAddCondition: (triggerId: string) => void;
  onUpdateCondition: (triggerId: string, conditionId: string, patch: Partial<Condition>) => void;
  onDeleteCondition: (triggerId: string, conditionId: string) => void;
}

const TRIGGER_OPTIONS: Array<{ key: TriggerType; label: string }> = [
  { key: "click", label: "On click" },
  { key: "timer", label: "On timer" },
  { key: "variable_change", label: "On variable change" },
];

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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-stone-900">Logic</div>
        <div className="w-40">
          <SelectField
            label="Add trigger"
            options={TRIGGER_OPTIONS.map((option) => ({ value: option.key, label: option.label }))}
            onChange={(value) => value && onAddTrigger(value as TriggerType)}
          />
        </div>
      </div>
      {element.triggers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 p-3 text-sm text-stone-500">
          No triggers yet. Add a trigger to define behavior.
        </div>
      ) : (
        <div className="space-y-3">
          {element.triggers.map((trigger) => (
            <div key={trigger.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium text-stone-900">
                  {TRIGGER_OPTIONS.find((option) => option.key === trigger.type)?.label}
                </div>
                <Button size="sm" color="danger" variant="light" onPress={() => onDeleteTrigger(trigger.id)}>
                  Remove
                </Button>
              </div>
              {trigger.type === "timer" && (
                <div className="mb-3 grid gap-2">
                  <TextInput
                    label="Interval ms"
                    type="number"
                    value={String(trigger.timerIntervalMs ?? 1000)}
                    onChange={(value) =>
                      onUpdateTrigger(trigger.id, { timerIntervalMs: Number(value || 1000) })
                    }
                  />
                  <Toggle
                    label="Auto-start"
                    checked={Boolean(trigger.timerAutoStart)}
                    onChange={(checked) => onUpdateTrigger(trigger.id, { timerAutoStart: checked })}
                  />
                </div>
              )}
              {trigger.type === "variable_change" && (
                <div className="mb-3 grid gap-2">
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
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Conditions</div>
                <Button size="sm" variant="light" onPress={() => onAddCondition(trigger.id)}>
                  Add IF
                </Button>
              </div>
              <div className="space-y-2">
                {trigger.conditions.map((condition, index) => (
                  <div key={condition.id} className="rounded-xl border border-stone-200 bg-white p-2">
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
                    <div className="grid gap-2">
                      <TextInput
                        label="Left"
                        value={condition.left}
                        onChange={(value) => onUpdateCondition(trigger.id, condition.id, { left: value })}
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
                        onChange={(value) => onUpdateCondition(trigger.id, condition.id, { right: value })}
                      />
                    </div>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      className="mt-2"
                      onPress={() => onDeleteCondition(trigger.id, condition.id)}
                    >
                      Remove condition
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mb-2 mt-4 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Actions</div>
                <Button size="sm" variant="flat" onPress={() => onAddAction(trigger.id)}>
                  Add action
                </Button>
              </div>
              <div className="space-y-2">
                {trigger.actions.map((action) => (
                  <div key={action.id} className="rounded-xl border border-stone-200 bg-white p-2">
                    <div className="grid gap-2">
                      <SelectField
                        label="Action"
                        value={action.type}
                        options={Object.entries(ACTION_LABELS).map(([key, label]) => ({
                          value: key,
                          label,
                        }))}
                        onChange={(value) =>
                          onUpdateAction(trigger.id, action.id, {
                            type: value as TriggerAction["type"],
                          })
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
                            onUpdateAction(trigger.id, action.id, {
                              targetVariableId: value,
                            })
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
                            onUpdateAction(trigger.id, action.id, {
                              targetElementId: value,
                            })
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
                            onUpdateAction(trigger.id, action.id, {
                              targetGroupId: value,
                            })
                          }
                        />
                      )}
                      {action.type !== "toggle_boolean" && action.type !== "show_element" && action.type !== "hide_element" &&
                      action.type !== "show_group" && action.type !== "hide_group" && action.type !== "bring_to_front" &&
                      action.type !== "send_to_back" && action.type !== "start_timer" && action.type !== "stop_timer" &&
                      action.type !== "pause_timer" && action.type !== "resume_timer" ? (
                        <TextInput
                          label="Value"
                          value={action.value ?? ""}
                          onChange={(value) => onUpdateAction(trigger.id, action.id, { value })}
                        />
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      className="mt-2"
                      onPress={() => onDeleteAction(trigger.id, action.id)}
                    >
                      Remove action
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
