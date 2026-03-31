import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
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
  CANVAS_DROP_ID,
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
import {
  applyHistoryCommit,
  canRedoDocument,
  canUndoDocument,
  createAutosavePayload,
  createEmptyDocumentSnapshot,
  createHistoryState,
  parseAutosavePayload,
  redoDocument,
  type DocumentHistoryState,
  type DocumentSnapshot,
  undoDocument,
} from "./utils/documentState";
import { getDefaultActionDraft } from "./utils/editorDefaults";
import { isThemeMode, type ThemeMode } from "./utils/theme";
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

interface ActiveCanvasDrag {
  activeId: string;
  activeType: ElementType;
  movingIds: string[];
  delta: { x: number; y: number };
}

interface DragSnapshot {
  activeId: string;
  activeType: ElementType;
  movingIds: string[];
  originalPositions: Record<string, { x: number; y: number }>;
}

const GROUP_DROP_ID_PREFIX = "group-drop:";
const GROUP_SIDE_PADDING = 20;
const GROUP_TOP_PADDING = 16;
const GROUP_BOTTOM_PADDING = 18;
const GROUP_SLOT_GAP = 12;
const GROUP_MIN_WIDTH = 120;
const GROUP_MIN_HEIGHT = 80;
const GROUP_HEADER_HEIGHT = 20;
const GROUP_HEADER_GAP = 12;
const DRAG_ACTIVATION_DISTANCE = 4;
const HISTORY_DEBOUNCE_MS = 500;
const AUTOSAVE_DEBOUNCE_MS = 1000;
const AUTOSAVE_STORAGE_KEY = "madegame-autosave";

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
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const savedTheme = window.localStorage.getItem("madegame-theme");
    if (savedTheme && isThemeMode(savedTheme)) {
      return savedTheme;
    }
    return "light";
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
  const initialDocumentSnapshot: DocumentSnapshot = {
    ...createEmptyDocumentSnapshot(),
    settings: {
      snapToGrid,
    },
  };
  const [panelVisibility, setPanelVisibility] = useState<PanelVisibilityState>(
    INITIAL_PANEL_VISIBILITY,
  );
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
  const [activeCanvasDrag, setActiveCanvasDrag] = useState<ActiveCanvasDrag | null>(null);
  const [paletteDragType, setPaletteDragType] = useState<ElementType | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1040, height: 720 });
  const [documentHistory, setDocumentHistory] = useState<DocumentHistoryState>(() =>
    createHistoryState(initialDocumentSnapshot),
  );
  const [restorePromptVisible, setRestorePromptVisible] = useState(false);
  const [restorableAutosave, setRestorableAutosave] = useState<DocumentSnapshot | null>(null);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const zIndexRef = useRef(1);
  const countersRef = useRef<Record<string, number>>({});
  const variableCountersRef = useRef<Record<VariableType, number>>({
    boolean: 0,
    number: 0,
    string: 0,
    string_array: 0,
  });
  const dragStateRef = useRef<DragState | null>(null);
  const dragSnapshotRef = useRef<DragSnapshot | null>(null);
  const suppressElementClickRef = useRef(false);
  const timerHandlesRef = useRef<Record<string, TimerHandle>>({});
  const runtimeTimersRef = useRef<RuntimeTimers>({});
  const runtimeElementsRef = useRef<CanvasElementModel[]>([]);
  const runtimeVariablesRef = useRef<GameVariable[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const latestDocumentRef = useRef<DocumentSnapshot>(initialDocumentSnapshot);
  const documentHistoryRef = useRef<DocumentHistoryState>(createHistoryState(initialDocumentSnapshot));
  const pendingHistoryTimerRef = useRef<number | null>(null);
  const pendingHistorySnapshotRef = useRef<DocumentSnapshot | null>(null);
  const pendingAutosaveTimerRef = useRef<number | null>(null);

  const activeElements = editorMode === "preview" ? runtimeElements : documentElements;
  const activeVariables = editorMode === "preview" ? runtimeVariables : documentVariables;
  const canUndo = canUndoDocument(documentHistory);
  const canRedo = canRedoDocument(documentHistory);
  const selectedElement = useMemo(
    () =>
      editorMode === "edit"
        ? documentElements.find((element) => element.id === selectedElementIds[0]) ?? null
        : null,
    [documentElements, editorMode, selectedElementIds],
  );
  const collisionDetectionStrategy = useMemo<CollisionDetection>(
    () => (args) => {
      const collisions = pointerWithin(args);
      const groupCollisions = collisions.filter(
        (collision) => parseGroupDropId(collision.id) !== null,
      );

      if (groupCollisions.length > 0) {
        return groupCollisions;
      }

      return collisions.filter((collision) => collision.id === CANVAS_DROP_ID);
    },
    [],
  );
  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE },
    }),
  );

  useEffect(() => {
    window.localStorage.setItem("madegame-theme", theme);
    if (theme !== "light") {
      window.localStorage.setItem("madegame-last-dark-theme", theme);
    }
    const root = document.documentElement;
    root.classList.remove(
      "theme-midnight",
      "theme-tokyo",
      "theme-dracula",
      "theme-nord",
    );
    if (theme === "midnight") {
      root.classList.add("theme-midnight");
    } else if (theme === "tokyo") {
      root.classList.add("theme-tokyo");
    } else if (theme === "dracula") {
      root.classList.add("theme-dracula");
    } else if (theme === "nord") {
      root.classList.add("theme-nord");
    }
    root.style.colorScheme = theme === "light" ? "light" : "dark";
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("madegame-snap-grid", String(snapToGrid));
  }, [snapToGrid]);

  useEffect(() => {
    const parsedAutosave = parseAutosavePayload(
      window.localStorage.getItem(AUTOSAVE_STORAGE_KEY),
    );
    if (!parsedAutosave) {
      window.localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
      setAutosaveReady(true);
      return;
    }

    const hasCurrentContent =
      latestDocumentRef.current.elements.length > 0 ||
      latestDocumentRef.current.variables.length > 0;

    if (hasCurrentContent) {
      setAutosaveReady(true);
      return;
    }

    setRestorableAutosave(parsedAutosave.snapshot);
    setRestorePromptVisible(true);
  }, []);

  useEffect(() => {
    if (!autosaveReady) {
      return;
    }

    if (pendingAutosaveTimerRef.current !== null) {
      window.clearTimeout(pendingAutosaveTimerRef.current);
    }

    pendingAutosaveTimerRef.current = window.setTimeout(() => {
      window.localStorage.setItem(
        AUTOSAVE_STORAGE_KEY,
        createAutosavePayload(latestDocumentRef.current),
      );
      pendingAutosaveTimerRef.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (pendingAutosaveTimerRef.current !== null) {
        window.clearTimeout(pendingAutosaveTimerRef.current);
      }
    };
  }, [autosaveReady, documentElements, documentVariables, snapToGrid]);

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

  useEffect(
    () => () => {
      clearAllTimers();
      if (pendingHistoryTimerRef.current !== null) {
        window.clearTimeout(pendingHistoryTimerRef.current);
      }
      if (pendingAutosaveTimerRef.current !== null) {
        window.clearTimeout(pendingAutosaveTimerRef.current);
      }
    },
    [],
  );

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

  function getGroupedElementIds(groupId: string, elements: CanvasElementModel[]) {
    return [
      groupId,
      ...elements
        .filter((element) => element.groupId === groupId)
        .map((element) => element.id),
    ];
  }

  function parseGroupDropId(id: UniqueIdentifier | null | undefined) {
    if (typeof id !== "string" || !id.startsWith(GROUP_DROP_ID_PREFIX)) {
      return null;
    }

    return id.slice(GROUP_DROP_ID_PREFIX.length);
  }

  function buildOriginalPositions(
    elements: CanvasElementModel[],
    elementIds: string[],
  ): Record<string, { x: number; y: number }> {
    return Object.fromEntries(
      elements
        .filter((element) => elementIds.includes(element.id))
        .map((element) => [element.id, { x: element.x, y: element.y }]),
    );
  }

  function constrainDeltaWithinBounds(
    elements: CanvasElementModel[],
    originalPositions: Record<string, { x: number; y: number }>,
    deltaX: number,
    deltaY: number,
  ) {
    const inset = 16;
    let minDeltaX = -Infinity;
    let maxDeltaX = Infinity;
    let minDeltaY = -Infinity;
    let maxDeltaY = Infinity;

    elements.forEach((element) => {
      const original = originalPositions[element.id];
      if (!original) {
        return;
      }

      const maxX = Math.max(inset, viewportSize.width - element.width - inset);
      const maxY = Math.max(inset, viewportSize.height - element.height - inset);

      minDeltaX = Math.max(minDeltaX, inset - original.x);
      maxDeltaX = Math.min(maxDeltaX, maxX - original.x);
      minDeltaY = Math.max(minDeltaY, inset - original.y);
      maxDeltaY = Math.min(maxDeltaY, maxY - original.y);
    });

    return {
      deltaX: Math.min(Math.max(deltaX, minDeltaX), maxDeltaX),
      deltaY: Math.min(Math.max(deltaY, minDeltaY), maxDeltaY),
    };
  }

  function rectanglesOverlap(
    left: { x: number; y: number; width: number; height: number },
    right: { x: number; y: number; width: number; height: number },
  ) {
    return (
      left.x < right.x + right.width &&
      left.x + left.width > right.x &&
      left.y < right.y + right.height &&
      left.y + left.height > right.y
    );
  }

  function isPointInsideRect(
    point: { x: number; y: number },
    rect: { x: number; y: number; width: number; height: number },
  ) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  function isElementCenterInsideGroup(
    element: CanvasElementModel,
    group: CanvasElementModel | null | undefined,
  ) {
    if (!group) {
      return false;
    }

    return isPointInsideRect(
      {
        x: element.x + element.width / 2,
        y: element.y + element.height / 2,
      },
      group,
    );
  }

  function getGroupLayoutGap(shouldSnap: boolean) {
    return shouldSnap ? GRID_SIZE : GROUP_SLOT_GAP;
  }

  function normalizeDocumentElements(
    elements: CanvasElementModel[],
    shouldSnap: boolean = snapToGrid,
  ) {
    const groupIds = new Set(
      elements
        .filter((element) => element.type === "group")
        .map((element) => element.id),
    );
    const sanitizedElements = elements.map((element) =>
      element.type !== "group" && element.groupId && !groupIds.has(element.groupId)
        ? { ...element, groupId: undefined }
        : element,
    );
    const updates = new Map<string, CanvasElementModel>();

    sanitizedElements
      .filter((element) => element.type === "group")
      .forEach((group) => {
        const members = sanitizedElements
          .filter((element) => element.type !== "group" && element.groupId === group.id)
          .sort(
            (left, right) =>
              left.y - right.y || left.x - right.x || left.zIndex - right.zIndex,
          );

        if (members.length === 0) {
          return;
        }

        const inset = 16;
        const gap = getGroupLayoutGap(shouldSnap);
        const widestMember = Math.max(...members.map((member) => member.width));
        const contentHeight =
          GROUP_HEADER_HEIGHT +
          GROUP_HEADER_GAP +
          members.reduce((total, member) => total + member.height, 0) +
          Math.max(0, members.length - 1) * gap;
        const desiredWidth = Math.max(widestMember + GROUP_SIDE_PADDING * 2, GROUP_MIN_WIDTH);
        const desiredHeight = Math.max(
          GROUP_TOP_PADDING + contentHeight + GROUP_BOTTOM_PADDING,
          GROUP_MIN_HEIGHT,
        );
        const width = Math.min(desiredWidth, Math.max(GROUP_MIN_WIDTH, viewportSize.width - inset * 2));
        const height = Math.min(
          desiredHeight,
          Math.max(GROUP_MIN_HEIGHT, viewportSize.height - inset * 2),
        );
        const maxGroupX = Math.max(inset, viewportSize.width - width - inset);
        const maxGroupY = Math.max(inset, viewportSize.height - height - inset);
        const groupX = Math.min(Math.max(group.x, inset), maxGroupX);
        const groupY = Math.min(Math.max(group.y, inset), maxGroupY);
        let nextY = groupY + GROUP_TOP_PADDING + GROUP_HEADER_HEIGHT + GROUP_HEADER_GAP;

        members.forEach((member) => {
          const sourceMember = updates.get(member.id) ?? member;
          const nextMember = {
            ...sourceMember,
            x: groupX + GROUP_SIDE_PADDING,
            y: nextY,
          };

          updates.set(nextMember.id, nextMember);
          nextY += sourceMember.height + gap;
        });

        updates.set(group.id, {
          ...group,
          x: groupX,
          y: groupY,
          width,
          height,
        });
      });

    return sanitizedElements.map((element) => updates.get(element.id) ?? element);
  }

  function cloneElements(elements: CanvasElementModel[]) {
    return elements.map((element) => cloneElement(element));
  }

  function cloneVariables(variables: GameVariable[]) {
    return variables.map((variable) => cloneVariable(variable));
  }

  function setDocumentHistoryState(nextHistory: DocumentHistoryState) {
    documentHistoryRef.current = nextHistory;
    setDocumentHistory(nextHistory);
  }

  function buildDocumentSnapshot(
    elements: CanvasElementModel[] = documentElements,
    variables: GameVariable[] = documentVariables,
    nextSnapToGrid: boolean = snapToGrid,
  ): DocumentSnapshot {
    return {
      elements: cloneElements(elements),
      variables: cloneVariables(variables),
      settings: {
        snapToGrid: nextSnapToGrid,
      },
    };
  }

  function normalizeDocumentSnapshot(snapshot: DocumentSnapshot): DocumentSnapshot {
    const nextSnapToGrid = snapshot.settings.snapToGrid;
    const normalizedElements = normalizeDocumentElements(
      snapshot.elements.map((element) =>
        clampElementToStage(cloneElement(element), nextSnapToGrid),
      ),
      nextSnapToGrid,
    );
    const normalizedVariables = cloneVariables(snapshot.variables);

    return {
      elements: normalizedElements,
      variables: normalizedVariables,
      settings: {
        snapToGrid: nextSnapToGrid,
      },
    };
  }

  function applyDocumentSnapshot(snapshot: DocumentSnapshot) {
    const normalizedSnapshot = normalizeDocumentSnapshot(snapshot);

    latestDocumentRef.current = buildDocumentSnapshot(
      normalizedSnapshot.elements,
      normalizedSnapshot.variables,
      normalizedSnapshot.settings.snapToGrid,
    );
    setDocumentElements(normalizedSnapshot.elements);
    setDocumentVariables(normalizedSnapshot.variables);
    setSnapToGrid(normalizedSnapshot.settings.snapToGrid);
    syncCountersFromDocument(normalizedSnapshot.elements, normalizedSnapshot.variables);
  }

  function flushPendingHistoryCommit() {
    if (
      pendingHistoryTimerRef.current === null ||
      pendingHistorySnapshotRef.current === null
    ) {
      return;
    }

    window.clearTimeout(pendingHistoryTimerRef.current);
    pendingHistoryTimerRef.current = null;

    const nextHistory = applyHistoryCommit(
      documentHistoryRef.current,
      pendingHistorySnapshotRef.current,
    );
    pendingHistorySnapshotRef.current = null;
    setDocumentHistoryState(nextHistory);
  }

  function commitDocumentChange(
    updater: (current: DocumentSnapshot) => DocumentSnapshot,
    historyMode: "immediate" | "debounced" | "skip" = "immediate",
  ) {
    const nextSnapshot = normalizeDocumentSnapshot(updater(latestDocumentRef.current));
    applyDocumentSnapshot(nextSnapshot);

    if (historyMode === "skip") {
      return nextSnapshot;
    }

    if (historyMode === "debounced") {
      pendingHistorySnapshotRef.current = nextSnapshot;
      if (pendingHistoryTimerRef.current !== null) {
        window.clearTimeout(pendingHistoryTimerRef.current);
      }
      pendingHistoryTimerRef.current = window.setTimeout(() => {
        if (!pendingHistorySnapshotRef.current) {
          return;
        }

        const nextHistory = applyHistoryCommit(
          documentHistoryRef.current,
          pendingHistorySnapshotRef.current,
        );
        pendingHistoryTimerRef.current = null;
        pendingHistorySnapshotRef.current = null;
        setDocumentHistoryState(nextHistory);
      }, HISTORY_DEBOUNCE_MS);
      return nextSnapshot;
    }

    flushPendingHistoryCommit();
    const nextHistory = applyHistoryCommit(documentHistoryRef.current, nextSnapshot);
    setDocumentHistoryState(nextHistory);
    return nextSnapshot;
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
    dragSnapshotRef.current = null;
    setActiveCanvasDrag(null);
    setDropTargetGroupId(null);
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
    dragSnapshotRef.current = null;
    setActiveCanvasDrag(null);
    setDropTargetGroupId(null);
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

    commitDocumentChange((current) => ({
      ...current,
      elements: [...current.elements, element],
    }));
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

    commitDocumentChange((current) => ({
      ...current,
      variables: [...current.variables, variable],
    }));
    setPanelVisibility((current) => ({
      ...current,
      variables: { open: true, minimized: false },
    }));
  }

  function updateElement(elementId: string, patch: Partial<CanvasElementModel>) {
    const historyMode =
      Object.keys(patch).some((key) => key === "text" || key === "name")
        ? "debounced"
        : "immediate";

    commitDocumentChange((current) => {
      const target = current.elements.find((element) => element.id === elementId);
      if (!target) {
        return current;
      }

      if (target.type === "group" && (patch.x !== undefined || patch.y !== undefined)) {
        const movingIds = getGroupedElementIds(elementId, current.elements);
        const originalPositions = buildOriginalPositions(current.elements, movingIds);
        const nextElements = current.elements.map((element) =>
          element.id === elementId ? { ...element, ...patch } : element,
        );
        const constrainedDelta = constrainDeltaWithinBounds(
          nextElements,
          originalPositions,
          (patch.x ?? target.x) - target.x,
          (patch.y ?? target.y) - target.y,
        );

        return {
          ...current,
          elements: current.elements.map((element) => {
            if (!movingIds.includes(element.id)) {
              return element;
            }

            const original = originalPositions[element.id];
            if (!original) {
              return element;
            }

            return {
              ...element,
              ...(element.id === elementId ? patch : {}),
              x: original.x + constrainedDelta.deltaX,
              y: original.y + constrainedDelta.deltaY,
            };
          }),
        };
      }

      return {
        ...current,
        elements: current.elements.map((element) =>
          element.id === elementId ? clampElementToStage({ ...element, ...patch }) : element,
        ),
      };
    }, historyMode);
  }

  function updateVariable(variableId: string, patch: Partial<GameVariable>) {
    commitDocumentChange(
      (current) => ({
        ...current,
        variables: current.variables.map((variable) =>
          variable.id === variableId ? { ...variable, ...patch } : variable,
        ),
      }),
      "debounced",
    );
  }

  function deleteVariable(variableId: string) {
    commitDocumentChange((current) => ({
      ...current,
      variables: current.variables.filter((variable) => variable.id !== variableId),
    }));
  }

  function deleteElements(elementIds: string[]) {
    if (elementIds.length === 0) {
      return;
    }

    commitDocumentChange((current) => {
      const deletedGroupIds = new Set(
        current.elements
          .filter((element) => elementIds.includes(element.id) && element.type === "group")
          .map((element) => element.id),
      );

      return {
        ...current,
        elements: current.elements
          .filter((element) => !elementIds.includes(element.id))
          .map((element) =>
            element.groupId && deletedGroupIds.has(element.groupId)
              ? { ...element, groupId: undefined }
              : element,
          ),
      };
    });
    setSelectedElementIds((current) =>
      current.filter((elementId) => !elementIds.includes(elementId)),
    );
  }

  function bringToFront(elementId: string) {
    updateElement(elementId, { zIndex: zIndexRef.current++ });
  }

  function sendToBack(elementId: string) {
    commitDocumentChange((current) => {
      const target = current.elements.find((element) => element.id === elementId);
      if (!target) return current;

      const minZIndex = Math.min(...current.elements.map((element) => element.zIndex));
      return {
        ...current,
        elements: current.elements.map((element) =>
          element.id === elementId ? { ...element, zIndex: minZIndex - 1 } : element,
        ),
      };
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
    commitDocumentChange((current) => ({
      ...current,
      elements: current.elements.map((element) =>
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
    }));
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
    commitDocumentChange((current) => ({
      ...current,
      elements: current.elements.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId ? { ...trigger, ...patch } : trigger,
              ),
            }
          : element,
      ),
    }));
  }

  function deleteTrigger(elementId: string, triggerId: string) {
    commitDocumentChange((current) => ({
      ...current,
      elements: current.elements.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.filter((trigger) => trigger.id !== triggerId),
            }
          : element,
      ),
    }));
  }

  function addAction(elementId: string, triggerId: string, branch: "then" | "else" = "then") {
    const sourceElement = documentElements.find((element) => element.id === elementId);
    if (!sourceElement) {
      return;
    }
    const action = getDefaultActionDraft(
      makeId("action"),
      sourceElement,
      documentElements,
      documentVariables,
    );

    commitDocumentChange((current) => ({
      ...current,
      elements: current.elements.map((element) =>
        element.id === elementId
          ? {
              ...element,
              triggers: element.triggers.map((trigger) =>
                trigger.id === triggerId
                  ? {
                      ...trigger,
                      actions:
                        branch === "then" ? [...trigger.actions, action] : trigger.actions,
                      hasElse:
                        branch === "else" ? true : trigger.hasElse,
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
    }));
  }

  function updateAction(
    elementId: string,
    triggerId: string,
    actionId: string,
    patch: Partial<TriggerAction>,
    branch: "then" | "else" = "then",
  ) {
    commitDocumentChange((current) => ({
      ...current,
      elements: current.elements.map((element) =>
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
    }));
  }

  function deleteAction(
    elementId: string,
    triggerId: string,
    actionId: string,
    branch: "then" | "else" = "then",
  ) {
    commitDocumentChange((current) => ({
      ...current,
      elements: current.elements.map((element) =>
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
                      hasElse:
                        branch === "else"
                          ? (trigger.elseActions ?? []).filter(
                              (action) => action.id !== actionId,
                            ).length > 0
                          : trigger.hasElse,
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
    }));
  }

  function addCondition(elementId: string, triggerId: string) {
    const defaultVariableId = documentVariables[0]?.id;
    const condition: Condition = {
      id: makeId("condition"),
      left: "",
      leftVariableId: defaultVariableId,
      operator: "equals",
      right: "",
      rightMode: "value",
      join: "and",
    };

    commitDocumentChange((current) => ({
      ...current,
      elements: current.elements.map((element) =>
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
    }));
  }

  function updateCondition(
    elementId: string,
    triggerId: string,
    conditionId: string,
    patch: Partial<Condition>,
  ) {
    commitDocumentChange((current) => ({
      ...current,
      elements: current.elements.map((element) =>
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
    }));
  }

  function deleteCondition(elementId: string, triggerId: string, conditionId: string) {
    commitDocumentChange((current) => ({
      ...current,
      elements: current.elements.map((element) =>
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
    }));
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
    setDropTargetGroupId(null);
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
    setDropTargetGroupId(null);
  }

  function suppressNextElementClick() {
    suppressElementClickRef.current = true;
    window.setTimeout(() => {
      suppressElementClickRef.current = false;
    }, 0);
  }

  function clearActiveCanvasDrag() {
    dragSnapshotRef.current = null;
    setActiveCanvasDrag(null);
    setDropTargetGroupId(null);
  }

  function handleToggleSnapToGrid(nextSnapToGrid: boolean) {
    commitDocumentChange((current) => ({
      ...current,
      settings: {
        snapToGrid: nextSnapToGrid,
      },
    }));
  }

  function handleUndo() {
    if (editorMode !== "edit") {
      return;
    }

    flushPendingHistoryCommit();
    const nextHistory = undoDocument(documentHistoryRef.current);
    if (nextHistory === documentHistoryRef.current) {
      return;
    }

    applyDocumentSnapshot(nextHistory.present);
    setDocumentHistoryState(nextHistory);
  }

  function handleRedo() {
    if (editorMode !== "edit") {
      return;
    }

    flushPendingHistoryCommit();
    const nextHistory = redoDocument(documentHistoryRef.current);
    if (nextHistory === documentHistoryRef.current) {
      return;
    }

    applyDocumentSnapshot(nextHistory.present);
    setDocumentHistoryState(nextHistory);
  }

  function handleRestoreAutosave() {
    if (!restorableAutosave) {
      return;
    }

    flushPendingHistoryCommit();
    clearAllTimers();
    setEditorMode("edit");
    dragSnapshotRef.current = null;
    setActiveCanvasDrag(null);
    setDropTargetGroupId(null);
    setPaletteDragType(null);
    setSelectedElementIds([]);
    setSelectionBox(null);
    setSettingsOpen(false);

    const normalizedSnapshot = normalizeDocumentSnapshot(restorableAutosave);
    applyDocumentSnapshot(normalizedSnapshot);
    setDocumentHistoryState(createHistoryState(normalizedSnapshot));
    setRestorableAutosave(null);
    setRestorePromptVisible(false);
    setAutosaveReady(true);
    window.localStorage.setItem(
      AUTOSAVE_STORAGE_KEY,
      createAutosavePayload(normalizedSnapshot),
    );
  }

  function handleStartFresh() {
    window.localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    setRestorableAutosave(null);
    setRestorePromptVisible(false);
    setAutosaveReady(true);
  }

  function handleDragStart(event: DragStartEvent) {
    if (editorMode !== "edit") {
      return;
    }

    const activeId = String(event.active.id);
    const targetElement = documentElements.find((element) => element.id === activeId);
    if (!targetElement) {
      return;
    }

    setDropTargetGroupId(null);
    setSelectionBox(null);
    setSettingsOpen(false);

    if (!selectedElementIds.includes(activeId)) {
      setSelectedElementIds([activeId]);
      setPanelVisibility((current) => ({
        ...current,
        right: { open: true, minimized: false },
      }));
    }

    const shouldMoveGroup =
      selectedElementIds.includes(activeId) &&
      selectedElementIds.length > 1 &&
      targetElement.type !== "group";
    const movingIds = shouldMoveGroup
      ? selectedElementIds
      : targetElement.type === "group"
        ? getGroupedElementIds(activeId, documentElements)
        : [activeId];
    const originalPositions = buildOriginalPositions(documentElements, movingIds);

    dragSnapshotRef.current = {
      activeId,
      activeType: targetElement.type,
      movingIds,
      originalPositions,
    };
    setActiveCanvasDrag({
      activeId,
      activeType: targetElement.type,
      movingIds,
      delta: { x: 0, y: 0 },
    });
  }

  function handleDragMove(event: DragMoveEvent) {
    if (editorMode !== "edit") {
      return;
    }

    const dragSnapshot = dragSnapshotRef.current;
    if (!dragSnapshot) {
      return;
    }

    const constrainedDelta = constrainDeltaWithinBounds(
      documentElements,
      dragSnapshot.originalPositions,
      event.delta.x,
      event.delta.y,
    );
    let nextDropTarget: string | null = null;

    if (dragSnapshot.activeType !== "group" && dragSnapshot.movingIds.length === 1) {
      const previewElement = documentElements.find(
        (element) => element.id === dragSnapshot.activeId,
      );
      const projectedElement = previewElement
        ? {
            ...previewElement,
            x: previewElement.x + constrainedDelta.deltaX,
            y: previewElement.y + constrainedDelta.deltaY,
          }
        : null;
      const overGroupId = parseGroupDropId(event.over?.id);
      const currentGroup =
        previewElement?.groupId
          ? documentElements.find(
              (element) =>
                element.id === previewElement.groupId && element.type === "group",
            ) ?? null
          : null;

      if (overGroupId) {
        const overGroup = documentElements.find(
          (element) => element.id === overGroupId && element.type === "group",
        );
        if (projectedElement && isElementCenterInsideGroup(projectedElement, overGroup)) {
          nextDropTarget = overGroupId;
        }
      } else if (
        projectedElement &&
        currentGroup &&
        isElementCenterInsideGroup(projectedElement, currentGroup)
      ) {
        nextDropTarget = currentGroup.id;
      }
    }

    setActiveCanvasDrag({
      activeId: dragSnapshot.activeId,
      activeType: dragSnapshot.activeType,
      movingIds: dragSnapshot.movingIds,
      delta: {
        x: constrainedDelta.deltaX,
        y: constrainedDelta.deltaY,
      },
    });
    setDropTargetGroupId(nextDropTarget);
  }

  function handleDragCancel(_event: DragCancelEvent) {
    if (editorMode !== "edit") {
      return;
    }

    clearActiveCanvasDrag();
  }

  function handleDragEnd(event: DragEndEvent) {
    if (editorMode !== "edit") {
      return;
    }

    const dragSnapshot = dragSnapshotRef.current;
    if (!dragSnapshot) {
      clearActiveCanvasDrag();
      return;
    }

    const constrainedDelta = constrainDeltaWithinBounds(
      documentElements,
      dragSnapshot.originalPositions,
      event.delta.x,
      event.delta.y,
    );
    const dropId = event.over?.id;
    const rawDropGroupId =
      dragSnapshot.activeType !== "group" && dragSnapshot.movingIds.length === 1
        ? parseGroupDropId(dropId)
        : null;
    const droppedOnCanvas = dropId === CANVAS_DROP_ID;

    suppressNextElementClick();
    commitDocumentChange((current) => {
      let nextElements = current.elements.map((element) => {
        const original = dragSnapshot.originalPositions[element.id];
        if (!original) {
          return element;
        }

        return {
          ...element,
          zIndex:
            element.id === dragSnapshot.activeId ? zIndexRef.current++ : element.zIndex,
          x: original.x + constrainedDelta.deltaX,
          y: original.y + constrainedDelta.deltaY,
        };
      });

      if (dragSnapshot.activeType === "group" || dragSnapshot.movingIds.length !== 1) {
        return {
          ...current,
          elements: nextElements,
        };
      }

      const targetElement = nextElements.find(
        (element) => element.id === dragSnapshot.activeId,
      );
      if (!targetElement || targetElement.type === "group") {
        return {
          ...current,
          elements: nextElements,
        };
      }

      const currentGroup =
        targetElement.groupId
          ? nextElements.find(
              (element) => element.id === targetElement.groupId && element.type === "group",
            ) ?? null
          : null;
      const droppedGroup =
        rawDropGroupId
          ? nextElements.find(
              (element) => element.id === rawDropGroupId && element.type === "group",
            ) ?? null
          : null;
      const nextGroupId =
        droppedGroup && isElementCenterInsideGroup(targetElement, droppedGroup)
          ? droppedGroup.id
          : currentGroup && isElementCenterInsideGroup(targetElement, currentGroup)
            ? currentGroup.id
            : droppedOnCanvas || !dropId
              ? undefined
              : undefined;

      nextElements = nextElements.map((element) =>
        element.id === targetElement.id
          ? clampElementToStage(
              {
                ...element,
                groupId: nextGroupId,
              },
              false,
            )
          : element,
      );

      return {
        ...current,
        elements: nextElements,
      };
    });

    clearActiveCanvasDrag();
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

    if (suppressElementClickRef.current) {
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
    dragSnapshotRef.current = null;
    setActiveCanvasDrag(null);
    setDropTargetGroupId(null);
    commitDocumentChange(() => ({
      elements: (documentState.elements ?? []).map((element) => cloneElement(element)),
      variables: cloneVariables(documentState.variables ?? []),
      settings: {
        snapToGrid: nextSnapToGrid,
      },
    }));
    commitRuntime([], []);
    setPanelVisibility(documentState.panelVisibility ?? INITIAL_PANEL_VISIBILITY);
    setSelectedElementIds([]);
    setSelectionBox(null);
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
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !isEditable) {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "y" && !isEditable) {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }

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
      className=""
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

      {restorePromptVisible && (
        <div className="modal-backdrop">
          <div className="restore-modal">
            <div className="restore-modal-title">Restore last autosaved project?</div>
            <p className="restore-modal-copy">
              A local autosave from your previous session is available.
            </p>
            <div className="restore-modal-actions">
              <button className="btn btn-accent" type="button" onClick={handleRestoreAutosave}>
                Restore
              </button>
              <button className="btn btn-ghost" type="button" onClick={handleStartFresh}>
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}

      <PanelToggleBar
        panelVisibility={panelVisibility}
        onOpenPanel={(panel) => togglePanel(panel, "open")}
        mode={editorMode}
        onEnterPreview={enterPreview}
        onExitPreview={exitPreview}
        onResetPreview={() => resetPreview()}
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
        theme={theme}
        snapToGrid={snapToGrid}
        disabled={editorMode === "preview"}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onChangeTheme={setTheme}
        onToggleSnapToGrid={handleToggleSnapToGrid}
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

          <DndContext
            sensors={dndSensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <CanvasWorkspace
              mode={editorMode}
              elements={activeElements}
              variables={activeVariables}
              selectedElementIds={editorMode === "edit" ? selectedElementIds : []}
              dropTargetGroupId={editorMode === "edit" ? dropTargetGroupId : null}
              draggingElementIds={
                editorMode === "edit" ? activeCanvasDrag?.movingIds ?? [] : []
              }
              dragOffset={
                editorMode === "edit"
                  ? activeCanvasDrag?.delta ?? { x: 0, y: 0 }
                  : { x: 0, y: 0 }
              }
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
              onElementClick={handleElementClick}
              onInputValueChange={(elementId, value) => {
                if (editorMode === "preview") {
                  handleRuntimeInputValueChange(elementId, value);
                  return;
                }

                updateElement(elementId, { text: value });
              }}
            />
          </DndContext>
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
