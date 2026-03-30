import { Button } from "@heroui/react";
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
  onAddAction: (elementId: string, triggerId: string) => void;
  onUpdateAction: (
    elementId: string,
    triggerId: string,
    actionId: string,
    patch: Partial<TriggerAction>,
  ) => void;
  onDeleteAction: (elementId: string, triggerId: string, actionId: string) => void;
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

  if (!panelState.open) {
    return null;
  }

  return (
    <aside className="panel-shell w-[22rem] border-l">
      <div className="panel-header">
        <div className="panel-title">Inspector</div>
        <div className="flex gap-1">
          <button className="panel-icon" onClick={onClose}>
            x
          </button>
        </div>
      </div>
      <div className="space-y-4 overflow-y-auto">
        {!selectedElement ? (
          <div className="rounded-2xl border border-dashed border-stone-200 p-3 text-sm text-stone-500">
            Shift-click an element to inspect and edit it.
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="text-sm font-semibold text-stone-900">{selectedElement.name}</div>
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
              <div className="grid grid-cols-2 gap-2">
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
              </div>
              <div className="grid grid-cols-2 gap-2">
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
                onChange={(value) => onUpdateElement(selectedElement.id, { groupId: value || undefined })}
                options={elements
                  .filter((entry) => entry.type === "group")
                  .map((entry) => ({
                    value: entry.id,
                    label: `${entry.name} (${entry.type})`,
                  }))}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="flat" onPress={() => onBringToFront(selectedElement.id)}>
                  Bring to front
                </Button>
                <Button size="sm" variant="flat" onPress={() => onSendToBack(selectedElement.id)}>
                  Send to back
                </Button>
                <Button size="sm" color="danger" variant="light" onPress={() => onDeleteElement(selectedElement.id)}>
                  Delete
                </Button>
              </div>
            </section>
            <LogicEditor
              element={selectedElement}
              elements={elements}
              variables={variables}
              onAddTrigger={(type) => onAddTrigger(selectedElement.id, type)}
              onUpdateTrigger={(triggerId, patch) => onUpdateTrigger(selectedElement.id, triggerId, patch)}
              onDeleteTrigger={(triggerId) => onDeleteTrigger(selectedElement.id, triggerId)}
              onAddAction={(triggerId) => onAddAction(selectedElement.id, triggerId)}
              onUpdateAction={(triggerId, actionId, patch) =>
                onUpdateAction(selectedElement.id, triggerId, actionId, patch)
              }
              onDeleteAction={(triggerId, actionId) =>
                onDeleteAction(selectedElement.id, triggerId, actionId)
              }
              onAddCondition={(triggerId) => onAddCondition(selectedElement.id, triggerId)}
              onUpdateCondition={(triggerId, conditionId, patch) =>
                onUpdateCondition(selectedElement.id, triggerId, conditionId, patch)
              }
              onDeleteCondition={(triggerId, conditionId) =>
                onDeleteCondition(selectedElement.id, triggerId, conditionId)
              }
            />
          </>
        )}
      </div>
    </aside>
  );
}
