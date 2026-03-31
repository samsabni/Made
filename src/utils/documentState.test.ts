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
});
