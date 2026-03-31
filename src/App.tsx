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
import {
  createDefaultElement,
  createDefaultTrigger,
  ELEMENT_LABELS,
  GRID_SIZE,
  NEW_VARIABLE_DEFAULTS,
} from "./constants";
import type {
  AppDocument,
  CanvasElementModel,
  Condition,
  EditorMode,
  ElementType,
  GameVariable,
  PanelVisibilityState,
  PrimitiveValue,
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

interface RuntimeDraft {
  elements: CanvasElementModel[];
  variables: GameVariable[];
}

interface TimerHandle {
  kind: "interval" | "timeout";
  id: number;
}

const INITIAL_PANEL_VISIBILITY: PanelVisibilityState = {
  left: { open: true, minimized: false },
  right: { open: true, minimized: false },
  variables: { open: true, minimized: false },
};

function clonePrimitiveValue(value: PrimitiveValue): PrimitiveValue {
  return Array.isArray(value) ? [...value] : value;
}

function cloneVariable(variable: GameVariable): GameVariable {
  return {
    ...variable,
    value: clonePrimitiveValue(variable.value),
  };
}

function cloneTrigger(trigger: TriggerDefinition): TriggerDefinition {
  return {
    ...trigger,
    conditions: trigger.conditions.map((condition) => ({ ...condition })),
    actions: trigger.actions.map((action) => ({ ...action })),
    elseActions: trigger.elseActions?.map((action) => ({ ...action })),
  };
}

function cloneElement(element: CanvasElementModel): CanvasElementModel {
  return {
    ...element,
    triggers: element.triggers.map(cloneTrigger),
  };
}

function valuesMatch(left: PrimitiveValue, right: PrimitiveValue) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.localStorage.getItem("madegame-theme") === "dark" ? "dark" : "light";
  });
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [documentElements, setDocumentElements] = useState<CanvasElementModel[]>([]);
  const [documentVariables, setDocumentVariables] = useState<GameVariable[]>([]);
  const [runtimeElements, setRuntimeElements] = useState<CanvasElementModel[]>([]);
  const [runtimeVariables, setRuntimeVariables] = useState<GameVariable[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("madegame-snap-grid") === "true";
  });
  const [panelVisibility, setPanelVisibility] = useState<PanelVisibilityState>(
    INITIAL_PANEL_VISIBILITY,
  );
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [paletteDragType, setPaletteDragType] = useState<ElementType | null>(null);
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
  const timerHandlesRef = useRef<Record<string, TimerHandle>>({});
  const runtimeTimersRef = useRef<RuntimeTimers>({});
  const runtimeElementsRef = useRef<CanvasElementModel[]>([]);
  const runtimeVariablesRef = useRef<GameVariable[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);

  const activeElements = editorMode === "preview" ? runtimeElements : documentElements;
  const activeVariables = editorMode === "preview" ? runtimeVariables : documentVariables;
  const selectedElement = useMemo(
    () =>
      editorMode === "edit"
        ? documentElements.find((element) => element.id === selectedElementIds[0]) ?? null
        : null,
    [documentElements, editorMode, selectedElementIds],
  );

  useEffect(() => {
    window.localStorage.setItem("madegame-theme", theme);
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("madegame-snap-grid", String(snapToGrid));
  }, [snapToGrid]);

  useEffect(() => {
    if (editorMode !== "edit") {
      return;
    }

    if (selectedElementIds.length === 0) {
      setPanelVisibility((current) => ({
        ...current,
        right: { ...current.right, open: false },
      }));
    }
  }, [editorMode, selectedElementIds]);

  useEffect(() => {
    const node = canvasViewportRef.current;
    if (!node) {
      return;
    }

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

  useEffect(() => () => clearAllTimers(), []);

  function makeId(prefix: string) {
    countersRef.current[prefix] = (countersRef.current[prefix] ?? 0) + 1;
    return `${prefix}-${countersRef.current[prefix]}`;
  }

  function clearTimerHandle(key: string) {
    const handle = timerHandlesRef.current[key];
    if (!handle) {
      return;
    }

    if (handle.kind === "interval") {
      window.clearInterval(handle.id);
    } else {
      window.clearTimeout(handle.id);
    }

    delete timerHandlesRef.current[key];
  }

  function clearAllTimers() {
    Object.keys(timerHandlesRef.current).forEach(clearTimerHandle);
    runtimeTimersRef.current = {};
  }

  function startTimer(elementId: string, triggerId: string, intervalMs: number) {
    const key = `${elementId}:${triggerId}`;
    clearTimerHandle(key);

    timerHandlesRef.current[key] = {
      kind: "interval",
      id: window.setInterval(() => {
        runRuntimeTriggerSet(elementId, "timer", undefined, triggerId);
      }, intervalMs),
    };

    runtimeTimersRef.current[key] = {
      running: true,
      paused: false,
      intervalMs,
      remainingMs: null,
      startedAt: Date.now(),
    };
  }

  function stopTimer(elementId: string, triggerId: string) {
    const key = `${elementId}:${triggerId}`;
    clearTimerHandle(key);

    runtimeTimersRef.current[key] = {
      running: false,
      paused: false,
      intervalMs: runtimeTimersRef.current[key]?.intervalMs ?? 1000,
      remainingMs: null,
      startedAt: null,
    };
  }

  function pauseTimer(elementId: string, triggerId: string) {
    const key = `${elementId}:${triggerId}`;
    const timer = runtimeTimersRef.current[key];
    if (!timer || !timer.running || timer.paused || timer.startedAt === null) {
      return;
    }

    const elapsed = Date.now() - timer.startedAt;
    clearTimerHandle(key);

    runtimeTimersRef.current[key] = {
      ...timer,
      paused: true,
      running: false,
      remainingMs: Math.max(timer.intervalMs - elapsed, 0),
    };
  }

  function resumeTimer(elementId: string, triggerId: string) {
    const key = `${elementId}:${triggerId}`;
    const timer = runtimeTimersRef.current[key];
    if (!timer || !timer.paused) {
      return;
    }

    const waitMs = timer.remainingMs ?? timer.intervalMs;
    clearTimerHandle(key);

    timerHandlesRef.current[key] = {
      kind: "timeout",
      id: window.setTimeout(() => {
        runRuntimeTriggerSet(elementId, "timer", undefined, triggerId);
        startTimer(elementId, triggerId, timer.intervalMs);
      }, waitMs),
    };

    runtimeTimersRef.current[key] = {
      ...timer,
      paused: false,
      running: true,
      remainingMs: null,
      startedAt: Date.now(),
    };
  }

  function syncCountersFromDocument(
    nextElements: CanvasElementModel[],
    nextVariables: GameVariable[],
  ) {
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
        nextCounters[idMatch[1]] = Math.max(
          nextCounters[idMatch[1]] ?? 0,
          Number(idMatch[2]),
        );
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
        nextCounters.variable = Math.max(
          nextCounters.variable ?? 0,
          Number(idMatch[1]),
        );
      }

      const patterns: Record<VariableType, RegExp> = {
        boolean: /^flag(\d+)$/,
        number: /^num(\d+)$/,
        string: /^text(\d+)$/,
        string_array: /^list(\d+)$/,
      };
      const match = variable.name.match(patterns[variable.type]);
      if (match) {
        nextVariableCounters[variable.type] = Math.max(
          nextVariableCounters[variable.type],
          Number(match[1]),
        );
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

  function snapPosition(value: number) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  function clampElementToStage(
    element: CanvasElementModel,
    shouldSnap: boolean = snapToGrid,
  ): CanvasElementModel {
    const inset = 16;
    const maxX = Math.max(inset, viewportSize.width - element.width - inset);
    const maxY = Math.max(inset, viewportSize.height - element.height - inset);
    const nextX = shouldSnap ? snapPosition(element.x) : element.x;
    const nextY = shouldSnap ? snapPosition(element.y) : element.y;

    return {
      ...element,
      x: Math.min(Math.max(nextX, inset), maxX),
      y: Math.min(Math.max(nextY, inset), maxY),
    };
  }

  function cloneElements(elements: CanvasElementModel[]) {
    return elements.map((element) => cloneElement(element));
  }

  function cloneVariables(variables: GameVariable[]) {
    return variables.map((variable) => cloneVariable(variable));
  }

  function commitRuntime(nextElements: CanvasElementModel[], nextVariables: GameVariable[]) {
    runtimeElementsRef.current = nextElements;
    runtimeVariablesRef.current = nextVariables;
    setRuntimeElements(nextElements);
    setRuntimeVariables(nextVariables);
  }

  function commitRuntimeElements(nextElements: CanvasElementModel[]) {
    runtimeElementsRef.current = nextElements;
    setRuntimeElements(nextElements);
  }

  function startAutoPreviewTimers(nextElements: CanvasElementModel[]) {
    nextElements.forEach((element) => {
      element.triggers
        .filter((trigger) => trigger.type === "timer" && trigger.timerAutoStart)
        .forEach((trigger) => {
          startTimer(element.id, trigger.id, trigger.timerIntervalMs ?? 1000);
        });
    });
  }

  function resetPreview(
    baseElements: CanvasElementModel[] = documentElements,
    baseVariables: GameVariable[] = documentVariables,
  ) {
    clearAllTimers();

    const nextElements = cloneElements(baseElements).map((element) =>
      clampElementToStage(element),
    );
    const nextVariables = cloneVariables(baseVariables);

    commitRuntime(nextElements, nextVariables);
    startAutoPreviewTimers(nextElements);
  }

  function enterPreview() {
    setEditorMode("preview");
    setSelectedElementIds([]);
    setSelectionBox(null);
    setSettingsOpen(false);
    setPaletteDragType(null);
    setPanelVisibility((current) => ({
      ...current,
      right: { ...current.right, open: false },
    }));
    resetPreview();
  }

  function exitPreview() {
    clearAllTimers();
    commitRuntime([], []);
    setEditorMode("edit");
    setSelectionBox(null);
    setPaletteDragType(null);
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

    setDocumentElements((current) => [...current, element]);
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

    setDocumentVariables((current) => [...current, variable]);
    setPanelVisibility((current) => ({
      ...current,
      variables: { open: true, minimized: false },
    }));
  }

  function updateElement(elementId: string, patch: Partial<CanvasElementModel>) {
    setDocumentElements((current) =>
      current.map((element) =>
        element.id === elementId ? clampElementToStage({ ...element, ...patch }) : element,
      ),
    );
  }

  function updateVariable(variableId: string, patch: Partial<GameVariable>) {
    setDocumentVariables((current) =>
      current.map((variable) =>
        variable.id === variableId ? { ...variable, ...patch } : variable,
      ),
    );
  }

  function deleteVariable(variableId: string) {
    setDocumentVariables((current) =>
      current.filter((variable) => variable.id !== variableId),
    );
  }

  function deleteElements(elementIds: string[]) {
    if (elementIds.length === 0) {
      return;
    }

    setDocumentElements((current) =>
      current.filter((element) => !elementIds.includes(element.id)),
    );
    setSelectedElementIds((current) =>
      current.filter((elementId) => !elementIds.includes(elementId)),
    );
  }

  function bringToFront(elementId: string) {
    updateElement(elementId, { zIndex: zIndexRef.current++ });
  }

  function sendToBack(elementId: string) {
    setDocumentElements((current) => {
      const target = current.find((element) => element.id === elementId);
      if (!target) return current;

      const minZIndex = Math.min(...current.map((element) => element.zIndex));
      return current.map((element) =>
        element.id === elementId ? { ...element, zIndex: minZIndex - 1 } : element,
      );
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
    setDocumentElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers:
                type === "timer"
                  ? [
                      ...element.triggers.filter((trigger) => trigger.type !== "timer"),
                      newTrigger,
                    ]
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

  function updateTrigger(
    elementId: string,
    triggerId: string,
    patch: Partial<TriggerDefinition>,
  ) {
    setDocumentElements((current) =>
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
    setDocumentElements((current) =>
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

    setDocumentElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId
                  ? {
                      ...trigger,
                      actions:
                        branch === "then" ? [...trigger.actions, action] : trigger.actions,
                      elseActions:
                        branch === "else"
                          ? [...(trigger.elseActions ?? []), action]
                          : trigger.elseActions,
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
    setDocumentElements((current) =>
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
    setDocumentElements((current) =>
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
                          ? (trigger.elseActions ?? []).filter(
                              (action) => action.id !== actionId,
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

  function addCondition(elementId: string, triggerId: string) {
    const condition: Condition = {
      id: makeId("condition"),
      left: "score",
      operator: "less_than",
      right: "10",
      join: "and",
    };

    setDocumentElements((current) =>
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
    setDocumentElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId
                  ? {
                      ...trigger,
                      conditions: trigger.conditions.map((condition) =>
                        condition.id === conditionId
                          ? { ...condition, ...patch }
                          : condition,
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
    setDocumentElements((current) =>
      current.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId
                  ? {
                      ...trigger,
                      conditions: trigger.conditions.filter(
                        (condition) => condition.id !== conditionId,
                      ),
                    }
                  : trigger,
              ),
            }
          : element,
      ),
    );
  }

  function updateDraftElement(
    draft: RuntimeDraft,
    elementId: string,
    patch: Partial<CanvasElementModel>,
  ) {
    draft.elements = draft.elements.map((element) =>
      element.id === elementId ? clampElementToStage({ ...element, ...patch }) : element,
    );
  }

  function bringDraftElementToFront(draft: RuntimeDraft, elementId: string) {
    const maxZIndex = Math.max(0, ...draft.elements.map((element) => element.zIndex));
    updateDraftElement(draft, elementId, { zIndex: maxZIndex + 1 });
  }

  function sendDraftElementToBack(draft: RuntimeDraft, elementId: string) {
    const minZIndex = Math.min(...draft.elements.map((element) => element.zIndex));
    updateDraftElement(draft, elementId, { zIndex: minZIndex - 1 });
  }

  function coerceValue(type: VariableType, value: string): PrimitiveValue {
    if (type === "boolean") return value === "true";
    if (type === "number") return Number(value || 0);
    if (type === "string_array") {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return value;
  }

  function applyRuntimeVariableChange(
    variableId: string,
    nextValue: PrimitiveValue,
    draft: RuntimeDraft,
    variableGuard: Set<string>,
  ) {
    const variable = draft.variables.find((entry) => entry.id === variableId);
    if (!variable || valuesMatch(variable.value, nextValue)) {
      return;
    }

    draft.variables = draft.variables.map((entry) =>
      entry.id === variableId
        ? { ...entry, value: clonePrimitiveValue(nextValue) }
        : entry,
    );

    if (variableGuard.has(variableId)) {
      return;
    }

    variableGuard.add(variableId);
    draft.elements.forEach((element) => {
      runRuntimeTriggerSet(
        element.id,
        "variable_change",
        variableId,
        undefined,
        draft,
        variableGuard,
      );
    });
    variableGuard.delete(variableId);
  }

  function executeRuntimeAction(
    action: TriggerAction,
    sourceElementId: string,
    draft: RuntimeDraft,
    variableGuard: Set<string>,
  ) {
    const variable = draft.variables.find((entry) => entry.id === action.targetVariableId);
    const targetElementId = action.targetElementId ?? sourceElementId;
    const targetElement = draft.elements.find((entry) => entry.id === targetElementId);
    const actionValue = action.value ?? "";

    switch (action.type) {
      case "set_variable":
        if (variable) {
          applyRuntimeVariableChange(
            variable.id,
            coerceValue(variable.type, actionValue),
            draft,
            variableGuard,
          );
        }
        return;
      case "add_number":
        if (variable?.type === "number") {
          applyRuntimeVariableChange(
            variable.id,
            Number(variable.value) + Number(actionValue || 0),
            draft,
            variableGuard,
          );
        }
        return;
      case "subtract_number":
        if (variable?.type === "number") {
          applyRuntimeVariableChange(
            variable.id,
            Number(variable.value) - Number(actionValue || 0),
            draft,
            variableGuard,
          );
        }
        return;
      case "toggle_boolean":
        if (variable?.type === "boolean") {
          applyRuntimeVariableChange(
            variable.id,
            !Boolean(variable.value),
            draft,
            variableGuard,
          );
        }
        return;
      case "append_string_array":
        if (variable?.type === "string_array") {
          applyRuntimeVariableChange(
            variable.id,
            [...(variable.value as string[]), actionValue],
            draft,
            variableGuard,
          );
        }
        return;
      case "remove_string_array":
        if (variable?.type === "string_array") {
          applyRuntimeVariableChange(
            variable.id,
            (variable.value as string[]).filter((entry) => entry !== actionValue),
            draft,
            variableGuard,
          );
        }
        return;
      case "change_text":
        if (targetElement) updateDraftElement(draft, targetElement.id, { text: actionValue });
        return;
      case "show_element":
        if (targetElement) updateDraftElement(draft, targetElement.id, { visible: true });
        return;
      case "hide_element":
        if (targetElement) updateDraftElement(draft, targetElement.id, { visible: false });
        return;
      case "show_group":
      case "hide_group":
        draft.elements = draft.elements.map((element) =>
          element.groupId === action.targetGroupId || element.id === action.targetGroupId
            ? { ...element, visible: action.type === "show_group" }
            : element,
        );
        return;
      case "bring_to_front":
        if (targetElement) bringDraftElementToFront(draft, targetElement.id);
        return;
      case "send_to_back":
        if (targetElement) sendDraftElementToBack(draft, targetElement.id);
        return;
      case "start_timer":
        if (targetElement) {
          const trigger = targetElement.triggers.find((entry) => entry.type === "timer");
          if (trigger) {
            startTimer(targetElement.id, trigger.id, trigger.timerIntervalMs ?? 1000);
          }
        }
        return;
      case "stop_timer":
        if (targetElement) {
          const trigger = targetElement.triggers.find((entry) => entry.type === "timer");
          if (trigger) {
            stopTimer(targetElement.id, trigger.id);
          }
        }
        return;
      case "pause_timer":
        if (targetElement) {
          const trigger = targetElement.triggers.find((entry) => entry.type === "timer");
          if (trigger) {
            pauseTimer(targetElement.id, trigger.id);
          }
        }
        return;
      case "resume_timer":
        if (targetElement) {
          const trigger = targetElement.triggers.find((entry) => entry.type === "timer");
          if (trigger) {
            resumeTimer(targetElement.id, trigger.id);
          }
        }
    }
  }

  function runRuntimeTriggerSet(
    elementId: string,
    triggerType: TriggerType,
    changedVariableId?: string,
    specificTriggerId?: string,
    existingDraft?: RuntimeDraft,
    variableGuard: Set<string> = new Set<string>(),
  ) {
    const draft =
      existingDraft ??
      {
        elements: cloneElements(runtimeElementsRef.current),
        variables: cloneVariables(runtimeVariablesRef.current),
      };
    const element = draft.elements.find((entry) => entry.id === elementId);
    if (!element) {
      return;
    }

    const matchingTriggers = element.triggers
      .filter((trigger) => trigger.type === triggerType)
      .filter((trigger) => (specificTriggerId ? trigger.id === specificTriggerId : true))
      .filter((trigger) => shouldRunTrigger(trigger, changedVariableId));

    if (matchingTriggers.length === 0) {
      return;
    }

    matchingTriggers.forEach((trigger) => {
      const conditionsPass = evaluateConditions(trigger.conditions, {
        elements: draft.elements,
        variables: draft.variables,
      });

      const branchActions = conditionsPass
        ? trigger.actions
        : trigger.hasElse
          ? trigger.elseActions ?? []
          : [];

      branchActions.forEach((action) =>
        executeRuntimeAction(action, elementId, draft, variableGuard),
      );
    });

    if (!existingDraft) {
      commitRuntime(draft.elements, draft.variables);
    }
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

  function getViewportCenterWorldPoint() {
    return {
      x: viewportSize.width / 2 - 90,
      y: viewportSize.height / 2 - 24,
    };
  }

  function handleCanvasPointerDown(
    point: WorldPoint,
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (editorMode !== "edit") {
      return;
    }

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

  function handleCanvasPointerMove(
    point: WorldPoint,
    _event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (editorMode !== "edit") {
      return;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.mode !== "selection") {
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

  function handleCanvasPointerUp(
    _point: WorldPoint,
    _event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (editorMode !== "edit") {
      return;
    }

    if (selectionBox) {
      const selected = documentElements
        .filter((element) => {
          const withinX =
            element.x + element.width >= selectionBox.x &&
            element.x <= selectionBox.x + selectionBox.width;
          const withinY =
            element.y + element.height >= selectionBox.y &&
            element.y <= selectionBox.y + selectionBox.height;
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
    if (editorMode !== "edit") {
      return;
    }

    if (event.shiftKey) {
      return;
    }

    if (!selectedElementIds.includes(elementId)) {
      setSelectedElementIds([elementId]);
      setPanelVisibility((current) => ({
        ...current,
        right: { open: true, minimized: false },
      }));
      setSettingsOpen(false);
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const shouldMoveGroup =
      selectedElementIds.includes(elementId) && selectedElementIds.length > 1;
    const movingIds = shouldMoveGroup ? selectedElementIds : [elementId];
    const originalPositions = Object.fromEntries(
      documentElements
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

  function handleElementPointerMove(
    point: WorldPoint,
    _event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (editorMode !== "edit") {
      return;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.mode !== "elements") {
      return;
    }

    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      dragStateRef.current = { ...dragState, moved: true };
    }

    setDocumentElements((current) =>
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
    if (editorMode !== "edit") {
      return;
    }

    if (dragStateRef.current?.mode === "elements") {
      if (dragStateRef.current.targetElementId) {
        bringToFront(dragStateRef.current.targetElementId);
      }

      if (dragStateRef.current.moved) {
        window.setTimeout(() => {
          dragStateRef.current = null;
        }, 0);
        return;
      }
    }

    dragStateRef.current = null;
  }

  function animateButtonPress(event: React.MouseEvent) {
    const button = (event.currentTarget as HTMLDivElement).querySelector(".canvas-button-el");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.getAnimations().forEach((animation) => animation.cancel());
    button.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(0.985)", offset: 0.2 },
        { transform: "scale(0.958)", offset: 0.52 },
        { transform: "scale(1.006)", offset: 0.88 },
        { transform: "scale(1)" },
      ],
      {
        duration: 180,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "none",
      },
    );
  }

  function handleElementClick(elementId: string, event: React.MouseEvent) {
    const dragState = dragStateRef.current;
    dragStateRef.current = null;

    if (editorMode === "preview") {
      const element = runtimeElementsRef.current.find((entry) => entry.id === elementId);
      if (!element || element.type !== "button") {
        return;
      }

      animateButtonPress(event);
      runRuntimeTriggerSet(elementId, "click");
      return;
    }

    const element = documentElements.find((entry) => entry.id === elementId);
    if (!element) {
      return;
    }

    if (event.shiftKey) {
      setSelectedElementIds((current) =>
        current.includes(elementId)
          ? current.filter((id) => id !== elementId)
          : [...current, elementId],
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

    setSelectedElementIds([elementId]);
    setPanelVisibility((current) => ({
      ...current,
      right: { open: true, minimized: false },
    }));
    setSettingsOpen(false);
  }

  function handleRuntimeInputValueChange(elementId: string, value: string) {
    commitRuntimeElements(
      runtimeElementsRef.current.map((element) =>
        element.id === elementId ? clampElementToStage({ ...element, text: value }) : element,
      ),
    );
  }

  function exportDocument() {
    const documentState: AppDocument = {
      elements: documentElements,
      variables: documentVariables,
      settings: {
        snapToGrid,
      },
      panelVisibility,
    };

    const blob = new Blob([JSON.stringify(documentState, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "madegame.json";
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  function importDocument(documentState: AppDocument) {
    const nextSnapToGrid = documentState.settings?.snapToGrid ?? false;

    clearAllTimers();
    setEditorMode("edit");
    setSnapToGrid(nextSnapToGrid);
    setDocumentElements(
      (documentState.elements ?? []).map((element) =>
        clampElementToStage(cloneElement(element), nextSnapToGrid),
      ),
    );
    setDocumentVariables(cloneVariables(documentState.variables ?? []));
    commitRuntime([], []);
    setPanelVisibility(documentState.panelVisibility ?? INITIAL_PANEL_VISIBILITY);
    setSelectedElementIds([]);
    setSelectionBox(null);
    syncCountersFromDocument(
      documentState.elements ?? [],
      documentState.variables ?? [],
    );
  }

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
    if (editorMode !== "edit") {
      return;
    }

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
  }, [editorMode, selectedElementIds]);

  return (
    <div
      className={theme === "dark" ? "theme-dark" : ""}
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleImportFile}
      />

      <PanelToggleBar
        panelVisibility={panelVisibility}
        onOpenPanel={(panel) => togglePanel(panel, "open")}
        onCreateVariable={() => createVariable()}
        mode={editorMode}
        onEnterPreview={enterPreview}
        onExitPreview={exitPreview}
        onResetPreview={() => resetPreview()}
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}

      <SettingsPanel
        open={settingsOpen && topbarVisible}
        snapToGrid={snapToGrid}
        disabled={editorMode === "preview"}
        onToggleSnapToGrid={setSnapToGrid}
        onExport={exportDocument}
        onImport={() => importInputRef.current?.click()}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        <VariablesPanel
          panelState={panelVisibility.variables}
          mode={editorMode}
          variables={activeVariables}
          onCreateVariable={() => createVariable()}
          onUpdateVariable={updateVariable}
          onDeleteVariable={deleteVariable}
          onClose={() => closePanel("variables")}
        />

        <div
          ref={canvasViewportRef}
          style={{ position: "relative", flex: 1, overflow: "hidden" }}
        >
          <div
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 30,
            }}
          >
            <LeftElementsPanel
              panelState={panelVisibility.left}
              onSpawnElement={(type) => {
                if (editorMode !== "edit") {
                  return;
                }

                const point = getViewportCenterWorldPoint();
                spawnElement(type, point.x, point.y);
              }}
              onBeginDrag={(type) => {
                if (editorMode === "edit") {
                  setPaletteDragType(type);
                }
              }}
              onEndDrag={() => setPaletteDragType(null)}
              disabled={editorMode !== "edit"}
              onClose={() => closePanel("left")}
            />
          </div>

          <CanvasWorkspace
            mode={editorMode}
            elements={activeElements}
            variables={activeVariables}
            selectedElementIds={editorMode === "edit" ? selectedElementIds : []}
            selectionBox={editorMode === "edit" ? selectionBox : null}
            onCanvasPointerDown={handleCanvasPointerDown}
            onCanvasPointerMove={handleCanvasPointerMove}
            onCanvasPointerUp={handleCanvasPointerUp}
            onDropPaletteItem={(point) => {
              if (editorMode === "edit" && paletteDragType) {
                spawnElement(paletteDragType, point.x, point.y);
                setPaletteDragType(null);
              }
            }}
            onElementPointerDown={handleElementPointerDown}
            onElementPointerMove={handleElementPointerMove}
            onElementPointerUp={handleElementPointerUp}
            onElementClick={handleElementClick}
            onInputValueChange={(elementId, value) => {
              if (editorMode === "preview") {
                handleRuntimeInputValueChange(elementId, value);
                return;
              }

              updateElement(elementId, { text: value });
            }}
          />
        </div>

        <RightInspectorPanel
          panelState={panelVisibility.right}
          mode={editorMode}
          selectedElement={selectedElement}
          elements={documentElements}
          variables={documentVariables}
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
