import { useEffect, useMemo, useRef, useState } from "react";
import { LeftElementsPanel } from "./components/LeftElementsPanel";
import { PanelToggleBar } from "./components/PanelToggleBar";
import { RightInspectorPanel } from "./components/RightInspectorPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { VariablesPanel } from "./components/VariablesPanel";
import {
  CanvasWorkspace,
  type SelectionBox,
  type WorldPoint,
} from "./components/CanvasWorkspace";
import { createDefaultElement, createDefaultTrigger, ELEMENT_LABELS, NEW_VARIABLE_DEFAULTS } from "./constants";
import type {
  AppDocument,
  CanvasElementModel,
  Condition,
  ElementType,
  GameVariable,
  PanelVisibilityState,
  RuntimeTimers,
  TriggerAction,
  TriggerDefinition,
  TriggerType,
  VariableType,
} from "./types";
import { evaluateConditions, shouldRunTrigger } from "./utils/logic";

interface DragState {
  mode: "selection" | "elements";
  startX: number;
  startY: number;
  originalPositions: Record<string, { x: number; y: number }>;
  moved: boolean;
  targetElementId?: string;
}

const INITIAL_PANEL_VISIBILITY: PanelVisibilityState = {
  left: { open: true, minimized: false },
  right: { open: true, minimized: false },
  variables: { open: true, minimized: false },
};

/**
 * Hosts the entire prototype state, including execution and timer runtime.
 * Keeping the logic in one module makes the first version easier to debug and extend.
 */
export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.localStorage.getItem("madegame-theme") === "dark" ? "dark" : "light";
  });
  const [elements, setElements] = useState<CanvasElementModel[]>([]);
  const [variables, setVariables] = useState<GameVariable[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelVisibility, setPanelVisibility] = useState<PanelVisibilityState>(INITIAL_PANEL_VISIBILITY);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [paletteDragType, setPaletteDragType] = useState<ElementType | null>(null);
  const [runtimeTimers, setRuntimeTimers] = useState<RuntimeTimers>({});
  const [viewportSize, setViewportSize] = useState({ width: 1040, height: 720 });
  const zIndexRef = useRef(1);
  const countersRef = useRef<Record<string, number>>({});
  const variableCountersRef = useRef<Record<VariableType, number>>({
    boolean: 0,
    number: 0,
    string: 0,
    string_array: 0,
  });
  const dragStateRef = useRef<DragState | null>(null);
  const variableExecutionGuardRef = useRef<Set<string>>(new Set());
  const timerHandlesRef = useRef<Record<string, number>>({});
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const selectedElement = useMemo(
    () => elements.find((element) => element.id === selectedElementIds[0]) ?? null,
    [elements, selectedElementIds],
  );

  useEffect(() => {
    window.localStorage.setItem("madegame-theme", theme);
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (selectedElementIds.length === 0) {
      setPanelVisibility((current) => ({
        ...current,
        right: { ...current.right, open: false },
      }));
    }
  }, [selectedElementIds]);

  useEffect(() => {
    const node = canvasViewportRef.current;
    if (!node) {
      return;
    }

    /**
     * Tracks the visible canvas viewport size so centering math uses the actual workspace.
     */
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /**
   * Starts or restarts a timer interval for an element trigger.
   * @param elementId - element owning the timer
   * @param triggerId - timer trigger id
   * @param intervalMs - current timer interval
   * @returns void
   */
  function startTimer(elementId: string, triggerId: string, intervalMs: number) {
    const key = `${elementId}:${triggerId}`;
    window.clearInterval(timerHandlesRef.current[key]);

    timerHandlesRef.current[key] = window.setInterval(() => {
      runTriggerSet(elementId, "timer", undefined, triggerId);
    }, intervalMs);

    setRuntimeTimers((current) => ({
      ...current,
      [key]: {
        running: true,
        paused: false,
        intervalMs,
        remainingMs: null,
        startedAt: Date.now(),
      },
    }));
  }

  function stopTimer(elementId: string, triggerId: string) {
    const key = `${elementId}:${triggerId}`;
    window.clearInterval(timerHandlesRef.current[key]);
    delete timerHandlesRef.current[key];

    setRuntimeTimers((current) => ({
      ...current,
      [key]: {
        running: false,
        paused: false,
        intervalMs: current[key]?.intervalMs ?? 1000,
        remainingMs: null,
        startedAt: null,
      },
    }));
  }

  function pauseTimer(elementId: string, triggerId: string) {
    const key = `${elementId}:${triggerId}`;
    const timer = runtimeTimers[key];
    if (!timer || !timer.running || timer.paused || timer.startedAt === null) {
      return;
    }

    const elapsed = Date.now() - timer.startedAt;
    const remainingMs = Math.max(timer.intervalMs - elapsed, 0);
    window.clearInterval(timerHandlesRef.current[key]);
    delete timerHandlesRef.current[key];

    setRuntimeTimers((current) => ({
      ...current,
      [key]: {
        ...timer,
        paused: true,
        running: false,
        remainingMs,
      },
    }));
  }

  function resumeTimer(elementId: string, triggerId: string) {
    const key = `${elementId}:${triggerId}`;
    const timer = runtimeTimers[key];
    if (!timer || !timer.paused) {
      return;
    }

    const waitMs = timer.remainingMs ?? timer.intervalMs;
    window.setTimeout(() => {
      runTriggerSet(elementId, "timer", undefined, triggerId);
      startTimer(elementId, triggerId, timer.intervalMs);
    }, waitMs);

    setRuntimeTimers((current) => ({
      ...current,
      [key]: {
        ...timer,
        paused: false,
        running: true,
        remainingMs: null,
        startedAt: Date.now(),
      },
    }));
  }

  useEffect(() => {
    elements.forEach((element) => {
      element.triggers
        .filter((trigger) => trigger.type === "timer" && trigger.timerAutoStart)
        .forEach((trigger) => {
          const key = `${element.id}:${trigger.id}`;
          if (!runtimeTimers[key]?.running && !runtimeTimers[key]?.paused) {
            startTimer(element.id, trigger.id, trigger.timerIntervalMs ?? 1000);
          }
        });
    });

    return () => {
      Object.values(timerHandlesRef.current).forEach((timerId) => window.clearInterval(timerId));
    };
  }, [elements]);

  function makeId(prefix: string) {
    countersRef.current[prefix] = (countersRef.current[prefix] ?? 0) + 1;
    return `${prefix}-${countersRef.current[prefix]}`;
  }

  /**
   * Clears all active timer intervals before loading a new document.
   * @returns void
   */
  function clearAllTimers() {
    Object.values(timerHandlesRef.current).forEach((timerId) => window.clearInterval(timerId));
    timerHandlesRef.current = {};
    setRuntimeTimers({});
  }

  /**
   * Rebuilds local id/name counters from imported content so newly created items keep incrementing cleanly.
   * @param nextElements - imported canvas elements
   * @param nextVariables - imported variables
   * @returns void
   */
  function syncCountersFromDocument(nextElements: CanvasElementModel[], nextVariables: GameVariable[]) {
    const nextCounters: Record<string, number> = {};
    const nextVariableCounters: Record<VariableType, number> = {
      boolean: 0,
      number: 0,
      string: 0,
      string_array: 0,
    };
    let nextZIndex = 1;

    nextElements.forEach((element) => {
      nextZIndex = Math.max(nextZIndex, element.zIndex + 1);

      const idMatch = element.id.match(/^(.*)-(\d+)$/);
      if (idMatch) {
        nextCounters[idMatch[1]] = Math.max(nextCounters[idMatch[1]] ?? 0, Number(idMatch[2]));
      }

      const typeLabel = ELEMENT_LABELS[element.type];
      const nameMatch = element.name.match(new RegExp(`^${typeLabel} (\\d+)$`));
      if (nameMatch) {
        nextCounters[`${element.type}-name`] = Math.max(
          nextCounters[`${element.type}-name`] ?? 0,
          Number(nameMatch[1]),
        );
      }
    });

    nextVariables.forEach((variable) => {
      const idMatch = variable.id.match(/^variable-(\d+)$/);
      if (idMatch) {
        nextCounters.variable = Math.max(nextCounters.variable ?? 0, Number(idMatch[1]));
      }

      const patterns: Record<VariableType, RegExp> = {
        boolean: /^flag(\d+)$/,
        number: /^num(\d+)$/,
        string: /^text(\d+)$/,
        string_array: /^list(\d+)$/,
      };
      const match = variable.name.match(patterns[variable.type]);
      if (match) {
        nextVariableCounters[variable.type] = Math.max(nextVariableCounters[variable.type], Number(match[1]));
      }
    });

    countersRef.current = nextCounters;
    variableCountersRef.current = nextVariableCounters;
    zIndexRef.current = nextZIndex;
  }

  function nextElementName(type: ElementType) {
    const key = `${type}-name`;
    countersRef.current[key] = (countersRef.current[key] ?? 0) + 1;
    return `${ELEMENT_LABELS[type]} ${countersRef.current[key]}`;
  }

  function nextVariableName(type: VariableType) {
    variableCountersRef.current[type] += 1;
    const index = variableCountersRef.current[type];
    if (type === "number") return `num${index}`;
    if (type === "boolean") return `flag${index}`;
    if (type === "string") return `text${index}`;
    return `list${index}`;
  }

  function spawnElement(type: ElementType, x = 0, y = 0) {
    const baseElement = createDefaultElement(
      type,
      makeId(type),
      nextElementName(type),
      zIndexRef.current++,
      x,
      y,
    );
    const element = clampElementToStage(baseElement);

    setElements((current) => [...current, element]);
    setSelectedElementIds([element.id]);
    setPanelVisibility((current) => ({
      ...current,
      right: { open: true, minimized: false },
    }));
  }

  function createVariable(type: VariableType = "number") {
    const variable: GameVariable = {
      id: makeId("variable"),
      name: nextVariableName(type),
      type,
      value: NEW_VARIABLE_DEFAULTS[type](),
    };

    setVariables((current) => [...current, variable]);
    setPanelVisibility((current) => ({
      ...current,
      variables: { open: true, minimized: false },
    }));
  }

  function updateElement(elementId: string, patch: Partial<CanvasElementModel>) {
    setElements((current) =>
      current.map((element) =>
        element.id === elementId ? clampElementToStage({ ...element, ...patch }) : element,
      ),
    );
  }

  /**
   * Keeps an element fully inside the visible static stage.
   * @param element - element candidate position and size
   * @returns clamped element
   */
  function clampElementToStage(element: CanvasElementModel): CanvasElementModel {
    const inset = 16;
    const maxX = Math.max(inset, viewportSize.width - element.width - inset);
    const maxY = Math.max(inset, viewportSize.height - element.height - inset);

    return {
      ...element,
      x: Math.min(Math.max(element.x, inset), maxX),
      y: Math.min(Math.max(element.y, inset), maxY),
    };
  }

  /**
   * Updates a variable and dispatches variable-change triggers only when the value actually changes.
   * A per-tick guard blocks a variable from recursively retriggering itself forever.
   * @param variableId - variable to mutate
   * @param nextValue - new runtime value
   * @returns void
   */
  function applyVariableChange(variableId: string, nextValue: GameVariable["value"]) {
    let changed = false;

    setVariables((current) =>
      current.map((variable) => {
        if (variable.id !== variableId) {
          return variable;
        }

        const sameValue = JSON.stringify(variable.value) === JSON.stringify(nextValue);
        if (!sameValue) {
          changed = true;
        }

        return sameValue ? variable : { ...variable, value: nextValue };
      }),
    );

    if (!changed || variableExecutionGuardRef.current.has(variableId)) {
      return;
    }

    variableExecutionGuardRef.current.add(variableId);
    elements.forEach((element) => runTriggerSet(element.id, "variable_change", variableId));
    variableExecutionGuardRef.current.delete(variableId);
  }

  /**
   * Executes matching triggers synchronously from top to bottom.
   * Conditions are checked first, then each action mutates the current state immediately.
   * @param elementId - element owning the trigger set
   * @param triggerType - requested trigger type to run
   * @param changedVariableId - optional variable id for variable-change events
   * @param specificTriggerId - optional timer id when only one trigger should run
   * @returns void
   */
  function runTriggerSet(
    elementId: string,
    triggerType: TriggerType,
    changedVariableId?: string,
    specificTriggerId?: string,
  ) {
    const element = elements.find((entry) => entry.id === elementId);
    if (!element) {
      return;
    }

    const currentElements = [...elements];
    const currentVariables = [...variables];

    element.triggers
      .filter((trigger) => trigger.type === triggerType)
      .filter((trigger) => (specificTriggerId ? trigger.id === specificTriggerId : true))
      .filter((trigger) => shouldRunTrigger(trigger, changedVariableId))
      .forEach((trigger) => {
        const conditionsPass = evaluateConditions(trigger.conditions, {
          elements: currentElements,
          variables: currentVariables,
        });

        if (!conditionsPass) {
          if (trigger.hasElse) {
            (trigger.elseActions ?? []).forEach((action) =>
              executeAction(action, currentElements, currentVariables),
            );
          }
          return;
        }

        trigger.actions.forEach((action) => executeAction(action, currentElements, currentVariables));
      });
  }

  function executeAction(
    action: TriggerAction,
    currentElements: CanvasElementModel[],
    currentVariables: GameVariable[],
  ) {
    const variable = currentVariables.find((entry) => entry.id === action.targetVariableId);
    const targetElementId = action.targetElementId ?? selectedElementIds[0];
    const targetElement = currentElements.find((entry) => entry.id === targetElementId);
    const actionValue = action.value ?? "";

    switch (action.type) {
      case "set_variable":
        if (variable) applyVariableChange(variable.id, coerceValue(variable.type, actionValue));
        return;
      case "add_number":
        if (variable?.type === "number") applyVariableChange(variable.id, Number(variable.value) + Number(actionValue || 0));
        return;
      case "subtract_number":
        if (variable?.type === "number")
          applyVariableChange(variable.id, Number(variable.value) - Number(actionValue || 0));
        return;
      case "toggle_boolean":
        if (variable?.type === "boolean") applyVariableChange(variable.id, !Boolean(variable.value));
        return;
      case "append_string_array":
        if (variable?.type === "string_array")
          applyVariableChange(variable.id, [...(variable.value as string[]), actionValue]);
        return;
      case "remove_string_array":
        if (variable?.type === "string_array")
          applyVariableChange(
            variable.id,
            (variable.value as string[]).filter((entry) => entry !== actionValue),
          );
        return;
      case "change_text":
        if (targetElement) updateElement(targetElement.id, { text: actionValue });
        return;
      case "show_element":
        if (targetElement) updateElement(targetElement.id, { visible: true });
        return;
      case "hide_element":
        if (targetElement) updateElement(targetElement.id, { visible: false });
        return;
      case "show_group":
      case "hide_group":
        setElements((current) =>
          current.map((element) =>
            element.groupId === action.targetGroupId || element.id === action.targetGroupId
              ? { ...element, visible: action.type === "show_group" }
              : element,
          ),
        );
        return;
      case "bring_to_front":
        if (targetElement) bringToFront(targetElement.id);
        return;
      case "send_to_back":
        if (targetElement) sendToBack(targetElement.id);
        return;
      case "start_timer":
        if (targetElement) {
          const trigger = targetElement.triggers.find((entry) => entry.type === "timer");
          if (trigger) startTimer(targetElement.id, trigger.id, trigger.timerIntervalMs ?? 1000);
        }
        return;
      case "stop_timer":
        if (targetElement) {
          const trigger = targetElement.triggers.find((entry) => entry.type === "timer");
          if (trigger) stopTimer(targetElement.id, trigger.id);
        }
        return;
      case "pause_timer":
        if (targetElement) {
          const trigger = targetElement.triggers.find((entry) => entry.type === "timer");
          if (trigger) pauseTimer(targetElement.id, trigger.id);
        }
        return;
      case "resume_timer":
        if (targetElement) {
          const trigger = targetElement.triggers.find((entry) => entry.type === "timer");
          if (trigger) resumeTimer(targetElement.id, trigger.id);
        }
    }
  }

  function coerceValue(type: VariableType, value: string) {
    if (type === "boolean") return value === "true";
    if (type === "number") return Number(value || 0);
    if (type === "string_array") return value.split(",").map((entry) => entry.trim()).filter(Boolean);
    return value;
  }

  function updateVariable(variableId: string, patch: Partial<GameVariable>) {
    setVariables((current) =>
      current.map((variable) => {
        if (variable.id !== variableId) {
          return variable;
        }

        const nextVariable = { ...variable, ...patch };
        return nextVariable;
      }),
    );
  }

  function deleteVariable(variableId: string) {
    setVariables((current) => current.filter((variable) => variable.id !== variableId));
  }

  /**
   * Deletes one or more elements and clears any selection/runtime state that points at them.
   * @param elementIds - canvas elements to remove
   * @returns void
   */
  function deleteElements(elementIds: string[]) {
    if (elementIds.length === 0) {
      return;
    }

    elementIds.forEach((elementId) => {
      const element = elements.find((entry) => entry.id === elementId);
      element?.triggers
        .filter((trigger) => trigger.type === "timer")
        .forEach((trigger) => stopTimer(elementId, trigger.id));
    });

    setElements((current) => current.filter((element) => !elementIds.includes(element.id)));
    setSelectedElementIds((current) => current.filter((elementId) => !elementIds.includes(elementId)));
  }

  function bringToFront(elementId: string) {
    updateElement(elementId, { zIndex: zIndexRef.current++ });
  }

  function sendToBack(elementId: string) {
    setElements((current) => {
      const target = current.find((element) => element.id === elementId);
      if (!target) return current;

      const minZIndex = Math.min(...current.map((element) => element.zIndex));
      return current.map((element) => (element.id === elementId ? { ...element, zIndex: minZIndex - 1 } : element));
    });
  }

  function togglePanel(panel: keyof PanelVisibilityState, mode: "open" | "minimize") {
    setPanelVisibility((current) => {
      const panelState = current[panel];
      if (mode === "open") {
        return {
          ...current,
          [panel]: { open: true, minimized: false },
        };
      }

      return {
        ...current,
        [panel]: { ...panelState, minimized: !panelState.minimized },
      };
    });
  }

  function closePanel(panel: keyof PanelVisibilityState) {
    setPanelVisibility((current) => ({
      ...current,
      [panel]: { ...current[panel], open: false },
    }));
  }

  function addTrigger(elementId: string, type: TriggerType) {
    const newTrigger = createDefaultTrigger(makeId("trigger"), type);
    setElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers:
                type === "timer"
                  ? [...element.triggers.filter((trigger) => trigger.type !== "timer"), newTrigger]
                  : [...element.triggers, newTrigger],
            }
          : element,
      ),
    );
    setPanelVisibility((current) => ({
      ...current,
      right: { open: true, minimized: false },
    }));
  }

  function updateTrigger(elementId: string, triggerId: string, patch: Partial<TriggerDefinition>) {
    setElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId ? { ...trigger, ...patch } : trigger,
              ),
            }
          : element,
      ),
    );
  }

  function deleteTrigger(elementId: string, triggerId: string) {
    stopTimer(elementId, triggerId);
    setElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.filter((trigger) => trigger.id !== triggerId),
            }
          : element,
      ),
    );
  }

  function addAction(elementId: string, triggerId: string, branch: "then" | "else" = "then") {
    const action: TriggerAction = {
      id: makeId("action"),
      type: "add_number",
      value: "1",
    };

    setElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId
                  ? {
                      ...trigger,
                      actions: branch === "then" ? [...trigger.actions, action] : trigger.actions,
                      elseActions:
                        branch === "else" ? [...(trigger.elseActions ?? []), action] : trigger.elseActions,
                    }
                  : trigger,
              ),
            }
          : element,
      ),
    );
  }

  function updateAction(
    elementId: string,
    triggerId: string,
    actionId: string,
    patch: Partial<TriggerAction>,
    branch: "then" | "else" = "then",
  ) {
    setElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId
                  ? {
                      ...trigger,
                      actions:
                        branch === "then"
                          ? trigger.actions.map((action) =>
                              action.id === actionId ? { ...action, ...patch } : action,
                            )
                          : trigger.actions,
                      elseActions:
                        branch === "else"
                          ? (trigger.elseActions ?? []).map((action) =>
                              action.id === actionId ? { ...action, ...patch } : action,
                            )
                          : trigger.elseActions,
                    }
                  : trigger,
              ),
            }
          : element,
      ),
    );
  }

  function deleteAction(
    elementId: string,
    triggerId: string,
    actionId: string,
    branch: "then" | "else" = "then",
  ) {
    setElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId
                  ? {
                      ...trigger,
                      actions:
                        branch === "then"
                          ? trigger.actions.filter((action) => action.id !== actionId)
                          : trigger.actions,
                      elseActions:
                        branch === "else"
                          ? (trigger.elseActions ?? []).filter((action) => action.id !== actionId)
                          : trigger.elseActions,
                    }
                  : trigger,
              ),
            }
          : element,
      ),
    );
  }

  function addCondition(elementId: string, triggerId: string) {
    const condition: Condition = {
      id: makeId("condition"),
      left: "score",
      operator: "less_than",
      right: "10",
      join: "and",
    };

    setElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId
                  ? { ...trigger, conditions: [...trigger.conditions, condition] }
                  : trigger,
              ),
            }
          : element,
      ),
    );
  }

  function updateCondition(
    elementId: string,
    triggerId: string,
    conditionId: string,
    patch: Partial<Condition>,
  ) {
    setElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId
                  ? {
                      ...trigger,
                      conditions: trigger.conditions.map((condition) =>
                        condition.id === conditionId ? { ...condition, ...patch } : condition,
                      ),
                    }
                  : trigger,
              ),
            }
          : element,
      ),
    );
  }

  function deleteCondition(elementId: string, triggerId: string, conditionId: string) {
    setElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId
                  ? {
                      ...trigger,
                      conditions: trigger.conditions.filter((condition) => condition.id !== conditionId),
                    }
                  : trigger,
              ),
            }
          : element,
      ),
    );
  }

  function beginSelection() {
    dragStateRef.current = {
      mode: "selection",
      startX: 0,
      startY: 0,
      originalPositions: {},
      moved: false,
    };
  }

  /**
   * Converts a visible viewport center into world coordinates for spawn placement.
   * @returns world position close to the middle of the current view
   */
  function getViewportCenterWorldPoint() {
    return {
      x: viewportSize.width / 2 - 90,
      y: viewportSize.height / 2 - 24,
    };
  }

  function handleCanvasPointerDown(point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(".canvas-element")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedElementIds([]);
    setSettingsOpen(false);
    beginSelection();
    dragStateRef.current = {
      mode: "selection",
      startX: point.x,
      startY: point.y,
      originalPositions: {},
      moved: false,
    };
    setSelectionBox({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function handleCanvasPointerMove(point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    if (dragState.mode !== "selection") {
      return;
    }

    dragStateRef.current = { ...dragState, moved: true };
    setSelectionBox({
      x: Math.min(dragState.startX, point.x),
      y: Math.min(dragState.startY, point.y),
      width: Math.abs(point.x - dragState.startX),
      height: Math.abs(point.y - dragState.startY),
    });
  }

  function handleCanvasPointerUp(_point: WorldPoint, _event: React.PointerEvent<HTMLDivElement>) {
    if (selectionBox) {
      const selected = elements
        .filter((element) => {
          const withinX = element.x + element.width >= selectionBox.x && element.x <= selectionBox.x + selectionBox.width;
          const withinY =
            element.y + element.height >= selectionBox.y && element.y <= selectionBox.y + selectionBox.height;
          return withinX && withinY;
        })
        .map((element) => element.id);
      setSelectedElementIds(selected);
      setPanelVisibility((current) => ({
        ...current,
        right: { open: selected.length > 0, minimized: false },
      }));
    }

    dragStateRef.current = null;
    setSelectionBox(null);
  }

  function handleElementPointerDown(
    elementId: string,
    point: WorldPoint,
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    const element = elements.find((entry) => entry.id === elementId);
    if (event.shiftKey) {
      return;
    }

    if (element?.type !== "button" && !selectedElementIds.includes(elementId)) {
      setSelectedElementIds([elementId]);
      setPanelVisibility((current) => ({
        ...current,
        right: { open: true, minimized: false },
      }));
      setSettingsOpen(false);
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const shouldMoveGroup = selectedElementIds.includes(elementId) && selectedElementIds.length > 1;
    const movingIds = shouldMoveGroup ? selectedElementIds : [elementId];
    const originalPositions = Object.fromEntries(
      elements
        .filter((element) => movingIds.includes(element.id))
        .map((element) => [element.id, { x: element.x, y: element.y }]),
    );

    dragStateRef.current = {
      mode: "elements",
      startX: point.x,
      startY: point.y,
      moved: false,
      targetElementId: elementId,
      originalPositions,
    };
  }

  function handleElementPointerMove(point: WorldPoint, _event: React.PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.mode !== "elements") {
      return;
    }

    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      dragStateRef.current = { ...dragState, moved: true };
    }

    setElements((current) =>
      current.map((element) => {
        const original = dragState.originalPositions[element.id];
        if (!original) {
          return element;
        }

        return clampElementToStage({
          ...element,
          x: original.x + deltaX,
          y: original.y + deltaY,
        });
      }),
    );
  }

  function handleElementPointerUp(
    _elementId: string,
    _point: WorldPoint,
    _event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (dragStateRef.current?.mode === "elements") {
      if (dragStateRef.current.targetElementId) {
        bringToFront(dragStateRef.current.targetElementId);
      }
      const moved = dragStateRef.current.moved;
      if (moved && dragStateRef.current.targetElementId) {
        window.setTimeout(() => {
          dragStateRef.current = null;
        }, 0);
        return;
      }
    }

    dragStateRef.current = null;
  }

  function handleElementClick(elementId: string, event: React.MouseEvent) {
    const dragState = dragStateRef.current;
    const element = elements.find((entry) => entry.id === elementId);
    dragStateRef.current = null;
    if (!element) return;

    if (event.shiftKey) {
      setSelectedElementIds((current) =>
        current.includes(elementId) ? current.filter((id) => id !== elementId) : [...current, elementId],
      );
      setPanelVisibility((current) => ({
        ...current,
        right: { open: true, minimized: false },
      }));
      return;
    }

    if (dragState?.moved) {
      return;
    }

    if (element.type !== "button") {
      setSelectedElementIds([elementId]);
      setPanelVisibility((current) => ({
        ...current,
        right: { open: true, minimized: false },
      }));
      setSettingsOpen(false);
    }

    if (element.type === "button") {
      runTriggerSet(elementId, "click");
    }
  }

  /**
   * Serializes the editor state to JSON and downloads it as a file.
   * @returns void
   */
  function exportDocument() {
    const documentState: AppDocument = {
      elements,
      variables,
      panelVisibility,
    };

    const blob = new Blob([JSON.stringify(documentState, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "madegame.json";
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Loads a saved JSON document into the editor and resets transient runtime state.
   * @param documentState - parsed save file
   * @returns void
   */
  function importDocument(documentState: AppDocument) {
    clearAllTimers();
    setElements((documentState.elements ?? []).map((element) => clampElementToStage(element)));
    setVariables(documentState.variables ?? []);
    setPanelVisibility(documentState.panelVisibility ?? INITIAL_PANEL_VISIBILITY);
    setSelectedElementIds([]);
    setSelectionBox(null);
    syncCountersFromDocument(documentState.elements ?? [], documentState.variables ?? []);
  }

  /**
   * Reads a user-selected JSON file and applies it if the structure is valid enough for v1.
   * @param event - file input change event
   * @returns void
   */
  function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppDocument;
        importDocument(parsed);
      } catch (error) {
        console.error("Failed to import document", error);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  useEffect(() => {
    /**
     * Deletes the current selection unless the user is typing in an input or inline text field.
     */
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isEditable || selectedElementIds.length === 0) {
        return;
      }

      event.preventDefault();
      deleteElements(selectedElementIds);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementIds, elements]);

  return (
    <div className={theme === "dark" ? "theme-dark" : ""} style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleImportFile}
      />

      {/* Floating top toolbar */}
      <PanelToggleBar
        panelVisibility={panelVisibility}
        onOpenPanel={(panel) => togglePanel(panel, "open")}
        onCreateVariable={() => createVariable()}
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
        visible={topbarVisible}
        onHide={() => setTopbarVisible(false)}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((current) => !current)}
      />

      {!topbarVisible && (
        <button
          className="topbar-restore-btn"
          type="button"
          onClick={() => setTopbarVisible(true)}
          aria-label="Show toolbar"
          title="Show toolbar"
          id="btn-show-topbar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      )}

      <SettingsPanel
        open={settingsOpen && topbarVisible}
        onExport={exportDocument}
        onImport={() => importInputRef.current?.click()}
      />

      {/* Main layout row */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Left: Variables panel */}
        <VariablesPanel
          panelState={panelVisibility.variables}
          variables={variables}
          onCreateVariable={() => createVariable()}
          onUpdateVariable={updateVariable}
          onDeleteVariable={deleteVariable}
          onClose={() => closePanel("variables")}
        />

        {/* Center: Canvas */}
        <div ref={canvasViewportRef} style={{ position: "relative", flex: 1, overflow: "hidden" }}>
          {/* Floating left elements toolbar */}
          <div style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 30,
          }}>
            <LeftElementsPanel
              panelState={panelVisibility.left}
              onSpawnElement={(type) => {
                const point = getViewportCenterWorldPoint();
                spawnElement(type, point.x, point.y);
              }}
              onClose={() => closePanel("left")}
            />
          </div>

          <CanvasWorkspace
            elements={elements}
            variables={variables}
            selectedElementIds={selectedElementIds}
            selectionBox={selectionBox}
            onCanvasPointerDown={handleCanvasPointerDown}
            onCanvasPointerMove={handleCanvasPointerMove}
            onCanvasPointerUp={handleCanvasPointerUp}
            onDropPaletteItem={(point) => {
              if (paletteDragType) {
                spawnElement(paletteDragType, point.x, point.y);
                setPaletteDragType(null);
              }
            }}
            onElementPointerDown={handleElementPointerDown}
            onElementPointerMove={handleElementPointerMove}
            onElementPointerUp={handleElementPointerUp}
            onElementClick={handleElementClick}
            onInputValueChange={(elementId, value) => updateElement(elementId, { text: value })}
          />
        </div>

        {/* Right: Inspector panel */}
        <RightInspectorPanel
          panelState={panelVisibility.right}
          selectedElement={selectedElement}
          elements={elements}
          variables={variables}
          onUpdateElement={updateElement}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          onDeleteElement={(elementId) => deleteElements([elementId])}
          onClose={() => closePanel("right")}
          onAddTrigger={addTrigger}
          onUpdateTrigger={updateTrigger}
          onDeleteTrigger={deleteTrigger}
          onAddAction={addAction}
          onUpdateAction={updateAction}
          onDeleteAction={deleteAction}
          onAddCondition={addCondition}
          onUpdateCondition={updateCondition}
          onDeleteCondition={deleteCondition}
        />
      </div>
    </div>
  );
}
