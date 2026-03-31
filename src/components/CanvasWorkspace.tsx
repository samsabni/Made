import { useDraggable, useDroppable } from "@dnd-kit/core";
import type React from "react";
import { useCallback, useRef } from "react";
import { CANVAS_DROP_ID, GRID_SIZE } from "../constants";
import type { CanvasElementModel, EditorMode, GameVariable } from "../types";
import { getVariableDisplayValue, renderBoundText } from "../utils/bindings";

const GROUP_DROP_ID_PREFIX = "group-drop:";
const ZERO_POINT = { x: 0, y: 0 };

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

interface CanvasWorkspaceProps {
  mode: EditorMode;
  elements: CanvasElementModel[];
  variables: GameVariable[];
  selectedElementIds: string[];
  dropTargetGroupId: string | null;
  draggingElementIds: string[];
  dragOffset: WorldPoint;
  selectionBox: SelectionBox | null;
  onCanvasPointerDown: (point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerMove: (point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerUp: (point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) => void;
  onDropPaletteItem: (point: WorldPoint) => void;
  onElementClick: (elementId: string, event: React.MouseEvent) => void;
  onInputValueChange: (elementId: string, value: string) => void;
}

interface CanvasElementNodeProps {
  mode: EditorMode;
  element: CanvasElementModel;
  variables: GameVariable[];
  isSelected: boolean;
  isGroupedBySelection: boolean;
  isDropTargetGroup: boolean;
  isDragging: boolean;
  dragOffset: WorldPoint;
  onElementClick: (elementId: string, event: React.MouseEvent) => void;
  onInputValueChange: (elementId: string, value: string) => void;
}

function getGroupDropId(groupId: string) {
  return `${GROUP_DROP_ID_PREFIX}${groupId}`;
}

function resolveElementText(element: CanvasElementModel, variables: GameVariable[]) {
  if (element.textSourceMode === "variable") {
    return getVariableDisplayValue(element.textVariableId, variables);
  }

  return renderBoundText(element.text, variables);
}

function resolveElementColor(
  variables: GameVariable[],
  variableId: string | undefined,
  fallback: string | undefined,
) {
  return getVariableDisplayValue(variableId, variables) || fallback;
}

function resolveFontWeight(element: CanvasElementModel) {
  switch (element.fontWeight) {
    case "regular":
      return 400;
    case "medium":
      return 500;
    case "semibold":
      return 600;
    case "bold":
      return 700;
    default:
      return 600;
  }
}

function CanvasElementNode(props: CanvasElementNodeProps) {
  const {
    mode,
    element,
    variables,
    isSelected,
    isGroupedBySelection,
    isDropTargetGroup,
    isDragging,
    dragOffset,
    onElementClick,
    onInputValueChange,
  } = props;
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
  } = useDraggable({
    id: element.id,
    disabled: mode !== "edit",
    data: {
      elementId: element.id,
      elementType: element.type,
    },
  });
  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: getGroupDropId(element.id),
    disabled: mode !== "edit" || element.type !== "group",
    data: {
      groupId: element.id,
      accepts: "canvas-element",
    },
  });

  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableNodeRef(node);
      if (element.type === "group") {
        setDroppableNodeRef(node);
      }
    },
    [element.type, setDraggableNodeRef, setDroppableNodeRef],
  );

  const offset = isDragging ? dragOffset : ZERO_POINT;
  const isGroup = element.type === "group";
  const baseStyle = {
    left: element.x + offset.x,
    top: element.y + offset.y,
    width: element.width,
    height: element.height,
    zIndex: isDragging ? element.zIndex + 1000 : element.zIndex,
  };

  return (
    <div
      ref={setNodeRef}
      className={`canvas-element ${mode === "edit" ? "canvas-element-draggable" : ""} ${isGroup ? "canvas-element-group-shell" : ""} ${isSelected ? "canvas-element-selected" : ""} ${isGroupedBySelection ? "canvas-element-group-member" : ""} ${isDropTargetGroup ? "canvas-element-group-drop-target" : ""} ${isDragging ? "canvas-element-dragging" : ""}`}
      style={baseStyle}
      onClick={isGroup ? undefined : (event) => onElementClick(element.id, event)}
      {...(mode === "edit" && !isGroup ? attributes : {})}
      {...(mode === "edit" && !isGroup ? listeners : {})}
    >
      <div className="canvas-el-inner" style={{ width: "100%", height: "100%" }}>
        {element.type === "button" && (
          <button
            type="button"
            className="canvas-button-el"
            style={{
              background:
                element.buttonBackgroundMode === "variable"
                  ? resolveElementColor(
                      variables,
                      element.buttonBackgroundVariableId,
                      element.buttonBackgroundColor,
                    )
                  : element.buttonBackgroundColor,
              color:
                element.buttonTextColorMode === "variable"
                  ? resolveElementColor(
                      variables,
                      element.buttonTextColorVariableId,
                      element.buttonTextColor,
                    )
                  : element.buttonTextColor,
              fontSize: element.fontSize ?? 14,
              fontWeight: resolveFontWeight(element),
              fontStyle: element.fontItalic ? "italic" : "normal",
            }}
          >
            {resolveElementText(element, variables)}
          </button>
        )}
        {element.type === "text" && (
          <div
            className="canvas-text-el"
            style={{
              fontSize: element.fontSize ?? 20,
              fontWeight: resolveFontWeight(element),
              fontStyle: element.fontItalic ? "italic" : "normal",
            }}
          >
            {renderBoundText(element.text, variables)}
          </div>
        )}
        {element.type === "panel" && (
          <div className="canvas-panel-el">{renderBoundText(element.text, variables)}</div>
        )}
        {element.type === "group" && (
          <div className="canvas-group-el">
            <button
              type="button"
              className="canvas-group-handle"
              onClick={(event) => {
                event.stopPropagation();
                onElementClick(element.id, event);
              }}
              {...(mode === "edit" ? attributes : {})}
              {...(mode === "edit" ? listeners : {})}
            >
              <span className="canvas-group-grip" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </span>
              <span className="canvas-group-label">{element.name}</span>
            </button>
          </div>
        )}
        {element.type === "input" && (
          <div className="canvas-input-el">
            <input
              style={{
                width: "100%",
                height: "100%",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontFamily: "inherit",
                fontSize: 14,
                padding: "0 12px",
                outline: "none",
              }}
              value={element.text}
              onPointerDown={(event) => {
                if (mode === "edit") {
                  event.stopPropagation();
                }
              }}
              onChange={(event) => onInputValueChange(element.id, event.target.value)}
              onFocus={(event) => {
                (event.target as HTMLInputElement).style.borderColor = "var(--accent)";
                (event.target as HTMLInputElement).style.background = "var(--bg-input-focus)";
                (event.target as HTMLInputElement).style.boxShadow = "var(--shadow-glow)";
              }}
              onBlur={(event) => {
                (event.target as HTMLInputElement).style.borderColor = "var(--border)";
                (event.target as HTMLInputElement).style.background = "var(--bg-input)";
                (event.target as HTMLInputElement).style.boxShadow = "none";
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  const {
    mode,
    elements,
    variables,
    selectedElementIds,
    dropTargetGroupId,
    draggingElementIds,
    dragOffset,
    selectionBox,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onDropPaletteItem,
    onElementClick,
    onInputValueChange,
  } = props;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { setNodeRef: setCanvasDroppableNodeRef } = useDroppable({
    id: CANVAS_DROP_ID,
    disabled: mode !== "edit",
    data: {
      surface: "canvas",
      accepts: "canvas-element",
    },
  });
  const activeGroupId =
    selectedElementIds.length === 1 &&
    elements.find(
      (element) => element.id === selectedElementIds[0] && element.type === "group",
    )?.id;

  const setViewportNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      setCanvasDroppableNodeRef(node);
    },
    [setCanvasDroppableNodeRef],
  );

  function toWorldPoint(clientX: number, clientY: number): WorldPoint {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  return (
    <div className="canvas-area">
      <div
        ref={setViewportNodeRef}
        className="canvas-viewport"
        data-mode={mode}
        style={{ backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` }}
        onPointerDown={(event) =>
          onCanvasPointerDown(toWorldPoint(event.clientX, event.clientY), event)
        }
        onPointerMove={(event) =>
          onCanvasPointerMove(toWorldPoint(event.clientX, event.clientY), event)
        }
        onPointerUp={(event) =>
          onCanvasPointerUp(toWorldPoint(event.clientX, event.clientY), event)
        }
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDropPaletteItem(toWorldPoint(event.clientX, event.clientY));
        }}
      >
        {elements.length === 0 && (
          <div className="canvas-empty-hint">
            <div className="canvas-empty-hint-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </div>
            <span className="canvas-empty-hint-text">
              Click an element in the toolbar to add it
            </span>
          </div>
        )}

        {[...elements]
          .filter(
            (element) =>
              element.visible && !(mode === "preview" && element.type === "group"),
          )
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((element) => (
            <CanvasElementNode
              key={element.id}
              mode={mode}
              element={element}
              variables={variables}
              isSelected={selectedElementIds.includes(element.id)}
              isGroupedBySelection={Boolean(activeGroupId && element.groupId === activeGroupId)}
              isDropTargetGroup={
                element.type === "group" && dropTargetGroupId === element.id
              }
              isDragging={draggingElementIds.includes(element.id)}
              dragOffset={dragOffset}
              onElementClick={onElementClick}
              onInputValueChange={onInputValueChange}
            />
          ))}

        {selectionBox && (
          <div
            className="selection-box"
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}
      </div>
    </div>
  );
}
