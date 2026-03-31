# Undo/Redo + Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add document-only undo/redo, debounced autosave, and a launch restore modal without mixing editor UI preferences into project history.

**Architecture:** Introduce a small pure document-history helper layer first, with snapshot cloning, history transitions, autosave payload handling, and empty-document checks covered by tests. Then refactor `src/App.tsx` so document mutations flow through shared commit helpers, wire keyboard shortcuts and settings controls, and finally add the restore modal and autosave lifecycle.

**Tech Stack:** React 18, TypeScript, Vite, localStorage, Vitest

---

### Task 1: Add a small tested document-history foundation

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/utils/documentState.ts`
- Create: `src/utils/documentState.test.ts`

- [ ] **Step 1: Add the failing tests and test runner dependencies**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.3",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^3.2.4"
  }
}
```

```ts
// src/utils/documentState.test.ts
import { describe, expect, it } from "vitest";
import type { CanvasElementModel, GameVariable } from "../types";
import {
  applyHistoryCommit,
  canRedoDocument,
  canUndoDocument,
  createAutosavePayload,
  createEmptyDocumentSnapshot,
  createHistoryState,
  isDocumentSnapshotEmpty,
  parseAutosavePayload,
  redoDocument,
  undoDocument,
} from "./documentState";

function makeElement(overrides: Partial<CanvasElementModel> = {}): CanvasElementModel {
  return {
    id: "button-1",
    name: "Button 1",
    type: "button",
    x: 40,
    y: 40,
    width: 180,
    height: 48,
    zIndex: 1,
    text: "Play",
    visible: true,
    triggers: [],
    ...overrides,
  };
}

function makeVariable(overrides: Partial<GameVariable> = {}): GameVariable {
  return {
    id: "variable-1",
    name: "num1",
    type: "number",
    value: 0,
    ...overrides,
  };
}

describe("documentState", () => {
  it("creates an empty snapshot", () => {
    expect(createEmptyDocumentSnapshot()).toEqual({
      elements: [],
      variables: [],
      settings: { snapToGrid: false },
    });
  });

  it("marks only a blank document as empty", () => {
    expect(isDocumentSnapshotEmpty(createEmptyDocumentSnapshot())).toBe(true);
    expect(
      isDocumentSnapshotEmpty({
        elements: [makeElement()],
        variables: [],
        settings: { snapToGrid: false },
      }),
    ).toBe(false);
    expect(
      isDocumentSnapshotEmpty({
        elements: [],
        variables: [],
        settings: { snapToGrid: true },
      }),
    ).toBe(false);
  });

  it("records commits and clears redo on new changes", () => {
    const initial = createHistoryState(createEmptyDocumentSnapshot());
    const first = applyHistoryCommit(initial, {
      elements: [makeElement()],
      variables: [],
      settings: { snapToGrid: false },
    });
    const second = applyHistoryCommit(first, {
      elements: [makeElement({ text: "Start" })],
      variables: [],
      settings: { snapToGrid: false },
    });

    expect(canUndoDocument(second)).toBe(true);
    expect(canRedoDocument(second)).toBe(false);
    expect(second.past).toHaveLength(2);

    const undone = undoDocument(second);
    const recommitted = applyHistoryCommit(undone, {
      elements: [makeElement({ text: "Again" })],
      variables: [makeVariable()],
      settings: { snapToGrid: false },
    });

    expect(recommitted.future).toEqual([]);
    expect(recommitted.present.variables).toHaveLength(1);
  });

  it("undoes and redoes snapshots in order", () => {
    const initial = createHistoryState(createEmptyDocumentSnapshot());
    const withElement = applyHistoryCommit(initial, {
      elements: [makeElement()],
      variables: [],
      settings: { snapToGrid: false },
    });
    const withVariable = applyHistoryCommit(withElement, {
      elements: [makeElement()],
      variables: [makeVariable()],
      settings: { snapToGrid: false },
    });

    const undone = undoDocument(withVariable);
    expect(undone.present.variables).toEqual([]);

    const redone = redoDocument(undone);
    expect(redone.present.variables).toHaveLength(1);
  });

  it("round-trips autosave payloads", () => {
    const snapshot = {
      elements: [makeElement()],
      variables: [makeVariable()],
      settings: { snapToGrid: true },
    };

    const payload = createAutosavePayload(snapshot, 1700000000000);
    expect(parseAutosavePayload(payload)?.snapshot).toEqual(snapshot);
    expect(parseAutosavePayload("{bad json}")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `npm test -- src/utils/documentState.test.ts`

Expected: FAIL because `src/utils/documentState.ts` and exported helpers do not exist yet.

- [ ] **Step 3: Implement the minimal history and autosave helpers**

```ts
// src/utils/documentState.ts
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
  return {
    elements: cloneDocumentSnapshot(snapshot).elements,
    variables: cloneDocumentSnapshot(snapshot).variables,
    settings: { snapToGrid: snapshot.settings.snapToGrid },
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
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/utils/documentState.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/utils/documentState.ts src/utils/documentState.test.ts
git commit -m "test: add document history helpers"
```

### Task 2: Route project mutations through a shared document commit path

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/types.ts`
- Test: `src/utils/documentState.test.ts`

- [ ] **Step 1: Add a failing test for history behavior that matches the app’s expected use**

```ts
it("can seed history from a restored snapshot without past or future entries", () => {
  const restored = {
    elements: [makeElement()],
    variables: [makeVariable()],
    settings: { snapToGrid: false },
  };

  const state = createHistoryState(restored);

  expect(state.present).toEqual(restored);
  expect(state.past).toEqual([]);
  expect(state.future).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify the new expectation fails**

Run: `npm test -- src/utils/documentState.test.ts`

Expected: FAIL only if the helper set is still missing the final history seeding behavior or needs adjustment.

- [ ] **Step 3: Refactor `src/App.tsx` to use a document snapshot commit layer**

```ts
// add near the top of src/App.tsx
import {
  applyHistoryCommit,
  canRedoDocument,
  canUndoDocument,
  createEmptyDocumentSnapshot,
  createHistoryState,
  isDocumentSnapshotEmpty,
  parseAutosavePayload,
  redoDocument,
  type DocumentHistoryState,
  type DocumentSnapshot,
  undoDocument,
} from "./utils/documentState";
```

```ts
// add new refs/state near the App component setup
const [documentHistory, setDocumentHistory] = useState<DocumentHistoryState>(() =>
  createHistoryState(createEmptyDocumentSnapshot()),
);
const pendingHistoryTimerRef = useRef<number | null>(null);
const pendingAutosaveTimerRef = useRef<number | null>(null);
const latestDocumentRef = useRef<DocumentSnapshot>(createEmptyDocumentSnapshot());
```

```ts
// add helper functions inside App()
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

function applyDocumentSnapshot(snapshot: DocumentSnapshot) {
  clearAllTimers();
  const normalizedElements = normalizeDocumentElements(
    snapshot.elements.map((element) => clampElementToStage(cloneElement(element), snapshot.settings.snapToGrid)),
    snapshot.settings.snapToGrid,
  );
  const normalizedVariables = cloneVariables(snapshot.variables);

  latestDocumentRef.current = {
    elements: cloneElements(normalizedElements),
    variables: normalizedVariables,
    settings: { snapToGrid: snapshot.settings.snapToGrid },
  };

  setDocumentElements(normalizedElements);
  setDocumentVariables(normalizedVariables);
  setSnapToGrid(snapshot.settings.snapToGrid);
  commitRuntime([], []);
  syncCountersFromDocument(normalizedElements, normalizedVariables);
}

function commitDocumentChange(
  buildNext: (current: DocumentSnapshot) => DocumentSnapshot,
  options: { history?: "immediate" | "debounced" | "skip" } = {},
) {
  const mode = options.history ?? "immediate";
  const nextSnapshot = buildNext(latestDocumentRef.current);
  applyDocumentSnapshot(nextSnapshot);

  if (mode === "skip") {
    return;
  }

  if (mode === "debounced") {
    if (pendingHistoryTimerRef.current !== null) {
      window.clearTimeout(pendingHistoryTimerRef.current);
    }
    pendingHistoryTimerRef.current = window.setTimeout(() => {
      setDocumentHistory((current) => applyHistoryCommit(current, nextSnapshot));
      pendingHistoryTimerRef.current = null;
    }, 500);
    return;
  }

  setDocumentHistory((current) => applyHistoryCommit(current, nextSnapshot));
}
```

```ts
// convert direct mutation sites to commitDocumentChange()
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
```

Convert the same way for:

- `createVariable`
- `updateElement`
- `updateVariable`
- `deleteVariable`
- `deleteElements`
- `sendToBack`
- `addTrigger`
- `updateTrigger`
- `deleteTrigger`
- `addAction`
- `updateAction`
- `deleteAction`
- `addCondition`
- `updateCondition`
- `deleteCondition`
- `handleDragEnd`
- `importDocument`
- snap-to-grid changes

Use debounced history mode for text-like inspector and input edits, immediate mode for the rest.

- [ ] **Step 4: Run tests and build to verify the refactor**

Run: `npm test -- src/utils/documentState.test.ts`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/types.ts src/utils/documentState.test.ts
git commit -m "feat: route editor document changes through history"
```

### Task 3: Add undo/redo commands, keyboard shortcuts, and settings controls

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/SettingsPanel.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add a failing test for undo/redo availability helpers**

```ts
it("reports undo and redo availability from history state", () => {
  const initial = createHistoryState(createEmptyDocumentSnapshot());
  const withElement = applyHistoryCommit(initial, {
    elements: [makeElement()],
    variables: [],
    settings: { snapToGrid: false },
  });

  expect(canUndoDocument(initial)).toBe(false);
  expect(canUndoDocument(withElement)).toBe(true);
  expect(canRedoDocument(withElement)).toBe(false);
  expect(canRedoDocument(undoDocument(withElement))).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify the new expectation fails if helpers are incomplete**

Run: `npm test -- src/utils/documentState.test.ts`

Expected: FAIL only if availability helpers are not implemented correctly yet.

- [ ] **Step 3: Implement editor undo/redo controls and key bindings**

```ts
// inside App()
const canUndo = canUndoDocument(documentHistory);
const canRedo = canRedoDocument(documentHistory);

function flushPendingHistoryCommit() {
  if (pendingHistoryTimerRef.current === null) {
    return;
  }

  window.clearTimeout(pendingHistoryTimerRef.current);
  pendingHistoryTimerRef.current = null;
  setDocumentHistory((current) => applyHistoryCommit(current, latestDocumentRef.current));
}

function handleUndo() {
  flushPendingHistoryCommit();
  setDocumentHistory((current) => {
    const next = undoDocument(current);
    applyDocumentSnapshot(next.present);
    return next;
  });
}

function handleRedo() {
  flushPendingHistoryCommit();
  setDocumentHistory((current) => {
    const next = redoDocument(current);
    applyDocumentSnapshot(next.present);
    return next;
  });
}
```

```ts
// extend the existing keydown effect in src/App.tsx
if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
  const target = event.target as HTMLElement | null;
  const isEditable =
    target?.tagName === "INPUT" ||
    target?.tagName === "TEXTAREA" ||
    target?.isContentEditable;

  if (!isEditable) {
    event.preventDefault();
    if (event.shiftKey) {
      handleRedo();
    } else {
      handleUndo();
    }
  }
}

if (event.ctrlKey && event.key.toLowerCase() === "y") {
  const target = event.target as HTMLElement | null;
  const isEditable =
    target?.tagName === "INPUT" ||
    target?.tagName === "TEXTAREA" ||
    target?.isContentEditable;

  if (!isEditable) {
    event.preventDefault();
    handleRedo();
  }
}
```

```tsx
// src/components/SettingsPanel.tsx
interface SettingsPanelProps {
  open: boolean;
  theme: ThemeMode;
  snapToGrid: boolean;
  disabled?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onChangeTheme: (theme: ThemeMode) => void;
  onToggleSnapToGrid: (checked: boolean) => void;
  onExport: () => void;
  onImport: () => void;
}

// inside settings actions
<div className="settings-actions">
  <button className="btn" onClick={onUndo} disabled={disabled || !canUndo}>Undo</button>
  <button className="btn" onClick={onRedo} disabled={disabled || !canRedo}>Redo</button>
</div>
```

```css
/* src/index.css */
.settings-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/utils/documentState.test.ts`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/SettingsPanel.tsx src/index.css src/utils/documentState.test.ts
git commit -m "feat: add undo and redo controls"
```

### Task 4: Add autosave storage and the launch restore modal

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Test: `src/utils/documentState.test.ts`

- [ ] **Step 1: Add a failing test for invalid autosave payload handling**

```ts
it("rejects autosave payloads with the wrong version", () => {
  expect(
    parseAutosavePayload(
      JSON.stringify({
        version: 2,
        savedAt: 1700000000000,
        snapshot: createEmptyDocumentSnapshot(),
      }),
    ),
  ).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/utils/documentState.test.ts`

Expected: FAIL if autosave parsing still accepts invalid payload shapes or versions.

- [ ] **Step 3: Implement debounced autosave and restore prompt UI**

```ts
// near App constants
const AUTOSAVE_STORAGE_KEY = "madegame-autosave";

// inside App state
const [restorePromptVisible, setRestorePromptVisible] = useState(false);
const [restorableAutosave, setRestorableAutosave] = useState<DocumentSnapshot | null>(null);

// on mount
useEffect(() => {
  const parsed = parseAutosavePayload(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY));
  if (!parsed) {
    return;
  }

  if (isDocumentSnapshotEmpty(latestDocumentRef.current)) {
    setRestorableAutosave(parsed.snapshot);
    setRestorePromptVisible(true);
  }
}, []);

// autosave effect
useEffect(() => {
  if (pendingAutosaveTimerRef.current !== null) {
    window.clearTimeout(pendingAutosaveTimerRef.current);
  }

  pendingAutosaveTimerRef.current = window.setTimeout(() => {
    window.localStorage.setItem(
      AUTOSAVE_STORAGE_KEY,
      createAutosavePayload(latestDocumentRef.current),
    );
    pendingAutosaveTimerRef.current = null;
  }, 1000);

  return () => {
    if (pendingAutosaveTimerRef.current !== null) {
      window.clearTimeout(pendingAutosaveTimerRef.current);
    }
  };
}, [documentElements, documentVariables, snapToGrid]);

function handleRestoreAutosave() {
  if (!restorableAutosave) {
    return;
  }

  applyDocumentSnapshot(restorableAutosave);
  setDocumentHistory(createHistoryState(restorableAutosave));
  setRestorePromptVisible(false);
  setRestorableAutosave(null);
}

function handleStartFresh() {
  window.localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  setRestorePromptVisible(false);
  setRestorableAutosave(null);
}
```

```tsx
// inside App render
{restorePromptVisible && (
  <div className="modal-backdrop">
    <div className="restore-modal">
      <div className="restore-modal-title">Restore last autosaved project?</div>
      <p className="restore-modal-copy">
        A local autosave was found from your previous session.
      </p>
      <div className="restore-modal-actions">
        <button className="btn btn-accent" onClick={handleRestoreAutosave}>
          Restore
        </button>
        <button className="btn btn-ghost" onClick={handleStartFresh}>
          Start fresh
        </button>
      </div>
    </div>
  </div>
)}
```

```css
/* src/index.css */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(7, 10, 18, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.restore-modal {
  width: min(420px, calc(100vw - 32px));
  padding: 24px;
  border-radius: 20px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.22);
}

.restore-modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/utils/documentState.test.ts`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/index.css src/utils/documentState.test.ts
git commit -m "feat: add autosave restore flow"
```

### Task 5: Final verification and cleanup

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/SettingsPanel.tsx`
- Modify: `src/index.css`
- Test: `src/utils/documentState.test.ts`

- [ ] **Step 1: Verify edge-case cleanup paths**

Ensure these details are present:

```ts
// clear pending timers on unmount
useEffect(() => {
  return () => {
    if (pendingHistoryTimerRef.current !== null) {
      window.clearTimeout(pendingHistoryTimerRef.current);
    }
    if (pendingAutosaveTimerRef.current !== null) {
      window.clearTimeout(pendingAutosaveTimerRef.current);
    }
  };
}, []);
```

```ts
// import should reset history baseline through a normal commit path
function importDocument(documentState: AppDocument) {
  const importedSnapshot: DocumentSnapshot = {
    elements: (documentState.elements ?? []).map((element) => cloneElement(element)),
    variables: cloneVariables(documentState.variables ?? []),
    settings: {
      snapToGrid: documentState.settings?.snapToGrid ?? false,
    },
  };

  commitDocumentChange(() => importedSnapshot, { history: "immediate" });
  setSelectedElementIds([]);
  setSelectionBox(null);
}
```

- [ ] **Step 2: Run the full verification suite**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Manual smoke test**

Check these behaviors in the app:

```text
1. Add an element, undo, redo.
2. Drag an element, undo the move, redo the move.
3. Type into text quickly, then undo once.
4. Import a project, then undo once.
5. Refresh after edits and confirm the restore prompt appears.
6. Choose Restore and verify the project returns.
7. Refresh again, choose Start fresh, and verify the prompt does not return.
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/SettingsPanel.tsx src/index.css src/utils/documentState.test.ts
git commit -m "chore: finalize undo redo autosave flow"
```
