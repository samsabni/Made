import type { AppDocument, CanvasElementModel, GameVariable, PrimitiveValue } from "../types";

export interface DocumentSnapshot {
  elements: CanvasElementModel[];
  variables: GameVariable[];
  settings: {
    snapToGrid: boolean;
  };
}

export interface DocumentHistoryState {
  past: DocumentSnapshot[];
  present: DocumentSnapshot;
  future: DocumentSnapshot[];
}

interface AutosavePayload {
  version: 1;
  savedAt: number;
  snapshot: DocumentSnapshot;
}

function clonePrimitiveValue(value: PrimitiveValue): PrimitiveValue {
  return Array.isArray(value) ? [...value] : value;
}

function cloneVariable(variable: GameVariable): GameVariable {
  return {
    ...variable,
    value: clonePrimitiveValue(variable.value),
  };
}

function cloneElement(element: CanvasElementModel): CanvasElementModel {
  return {
    ...element,
    triggers: element.triggers.map((trigger) => ({
      ...trigger,
      conditions: trigger.conditions.map((condition) => ({ ...condition })),
      actions: trigger.actions.map((action) => ({ ...action })),
      elseActions: trigger.elseActions?.map((action) => ({ ...action })),
    })),
  };
}

export function cloneDocumentSnapshot(snapshot: DocumentSnapshot): DocumentSnapshot {
  return {
    elements: snapshot.elements.map(cloneElement),
    variables: snapshot.variables.map(cloneVariable),
    settings: {
      snapToGrid: snapshot.settings.snapToGrid,
    },
  };
}

export function createEmptyDocumentSnapshot(): DocumentSnapshot {
  return {
    elements: [],
    variables: [],
    settings: {
      snapToGrid: false,
    },
  };
}

export function isDocumentSnapshotEmpty(snapshot: DocumentSnapshot): boolean {
  return (
    snapshot.elements.length === 0 &&
    snapshot.variables.length === 0 &&
    snapshot.settings.snapToGrid === false
  );
}

export function createHistoryState(initial: DocumentSnapshot): DocumentHistoryState {
  return {
    past: [],
    present: cloneDocumentSnapshot(initial),
    future: [],
  };
}

export function applyHistoryCommit(
  state: DocumentHistoryState,
  nextSnapshot: DocumentSnapshot,
): DocumentHistoryState {
  return {
    past: [...state.past, cloneDocumentSnapshot(state.present)],
    present: cloneDocumentSnapshot(nextSnapshot),
    future: [],
  };
}

export function canUndoDocument(state: DocumentHistoryState): boolean {
  return state.past.length > 0;
}

export function canRedoDocument(state: DocumentHistoryState): boolean {
  return state.future.length > 0;
}

export function undoDocument(state: DocumentHistoryState): DocumentHistoryState {
  if (!canUndoDocument(state)) {
    return state;
  }

  const previous = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: cloneDocumentSnapshot(previous),
    future: [cloneDocumentSnapshot(state.present), ...state.future],
  };
}

export function redoDocument(state: DocumentHistoryState): DocumentHistoryState {
  if (!canRedoDocument(state)) {
    return state;
  }

  const [next, ...rest] = state.future;
  return {
    past: [...state.past, cloneDocumentSnapshot(state.present)],
    present: cloneDocumentSnapshot(next),
    future: rest,
  };
}

export function snapshotToAppDocument(snapshot: DocumentSnapshot): AppDocument {
  const clonedSnapshot = cloneDocumentSnapshot(snapshot);
  return {
    elements: clonedSnapshot.elements,
    variables: clonedSnapshot.variables,
    settings: { snapToGrid: clonedSnapshot.settings.snapToGrid },
  };
}

export function createAutosavePayload(snapshot: DocumentSnapshot, savedAt = Date.now()): string {
  const payload: AutosavePayload = {
    version: 1,
    savedAt,
    snapshot: cloneDocumentSnapshot(snapshot),
  };
  return JSON.stringify(payload);
}

export function parseAutosavePayload(raw: string | null): AutosavePayload | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AutosavePayload>;
    if (parsed.version !== 1 || !parsed.snapshot || typeof parsed.savedAt !== "number") {
      return null;
    }
    return {
      version: 1,
      savedAt: parsed.savedAt,
      snapshot: cloneDocumentSnapshot(parsed.snapshot),
    };
  } catch {
    return null;
  }
}
