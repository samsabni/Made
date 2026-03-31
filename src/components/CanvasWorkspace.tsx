import type React from "react";
import { useRef } from "react";
import { GRID_SIZE } from "../constants";
import { getVariableDisplayValue, renderBoundText } from "../utils/bindings";
import type { CanvasElementModel, GameVariable } from "../types";

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
  elements: CanvasElementModel[];
  variables: GameVariable[];
  selectedElementIds: string[];
  selectionBox: SelectionBox | null;
  onCanvasPointerDown: (point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerMove: (point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerUp: (point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) => void;
  onDropPaletteItem: (point: WorldPoint) => void;
  onElementPointerDown: (elementId: string, point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) => void;
  onElementPointerMove: (point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) => void;
  onElementPointerUp: (elementId: string, point: WorldPoint, event: React.PointerEvent<HTMLDivElement>) => void;
  onElementClick: (elementId: string, event: React.MouseEvent) => void;
  onInputValueChange: (elementId: string, value: string) => void;
}

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  const {
    elements,
    variables,
    selectedElementIds,
    selectionBox,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onDropPaletteItem,
    onElementPointerDown,
    onElementPointerMove,
    onElementPointerUp,
    onElementClick,
    onInputValueChange,
  } = props;

  const viewportRef = useRef<HTMLDivElement | null>(null);

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

  function resolveElementText(element: CanvasElementModel) {
    if (element.textSourceMode === "variable") {
      return getVariableDisplayValue(element.textVariableId, variables);
    }

    return renderBoundText(element.text, variables);
  }

  function resolveElementColor(variableId: string | undefined, fallback: string | undefined) {
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

  return (
    <div className="canvas-area">
      <div
        ref={viewportRef}
        className="canvas-viewport"
        onPointerDown={(event) => onCanvasPointerDown(toWorldPoint(event.clientX, event.clientY), event)}
        onPointerMove={(event) => onCanvasPointerMove(toWorldPoint(event.clientX, event.clientY), event)}
        onPointerUp={(event) => onCanvasPointerUp(toWorldPoint(event.clientX, event.clientY), event)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDropPaletteItem(toWorldPoint(event.clientX, event.clientY));
        }}
      >
        {elements.length === 0 && (
          <div className="canvas-empty-hint">
            <div className="canvas-empty-hint-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>
              </svg>
            </div>
            <span className="canvas-empty-hint-text">Click an element in the toolbar to add it</span>
          </div>
        )}

        {[...elements]
          .filter((element) => element.visible)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((element) => {
            const isSelected = selectedElementIds.includes(element.id);
            const baseStyle = {
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              zIndex: element.zIndex,
            };

            return (
              <div
                key={element.id}
                className={`canvas-element ${isSelected ? "canvas-element-selected" : ""}`}
                style={baseStyle}
                onPointerDown={(event) =>
                  onElementPointerDown(element.id, toWorldPoint(event.clientX, event.clientY), event)
                }
                onPointerMove={(event) =>
                  onElementPointerMove(toWorldPoint(event.clientX, event.clientY), event)
                }
                onPointerUp={(event) =>
                  onElementPointerUp(element.id, toWorldPoint(event.clientX, event.clientY), event)
                }
                onClick={(event) => onElementClick(element.id, event)}
              >
                <div className="canvas-el-inner" style={{ width: "100%", height: "100%" }}>
                  {element.type === "button" && (
                    <button
                      className="canvas-button-el"
                      style={{
                        background:
                          element.buttonBackgroundMode === "variable"
                            ? resolveElementColor(element.buttonBackgroundVariableId, element.buttonBackgroundColor)
                            : element.buttonBackgroundColor,
                        color:
                          element.buttonTextColorMode === "variable"
                            ? resolveElementColor(element.buttonTextColorVariableId, element.buttonTextColor)
                            : element.buttonTextColor,
                        fontSize: element.fontSize ?? 14,
                        fontWeight: resolveFontWeight(element),
                        fontStyle: element.fontItalic ? "italic" : "normal",
                      }}
                    >
                      {resolveElementText(element)}
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
                    <div className="canvas-panel-el">
                      {renderBoundText(element.text, variables)}
                    </div>
                  )}
                  {element.type === "group" && (
                    <div className="canvas-group-el">
                      {element.name}
                    </div>
                  )}
                  {element.type === "input" && (
                    <div
                      className="canvas-input-el"
                    >
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
                        onChange={(e) => onInputValueChange(element.id, e.target.value)}
                        onFocus={(e) => {
                          (e.target as HTMLInputElement).style.borderColor = "var(--accent)";
                          (e.target as HTMLInputElement).style.background = "var(--bg-input-focus)";
                          (e.target as HTMLInputElement).style.boxShadow = "var(--shadow-glow)";
                        }}
                        onBlur={(e) => {
                          (e.target as HTMLInputElement).style.borderColor = "var(--border)";
                          (e.target as HTMLInputElement).style.background = "var(--bg-input)";
                          (e.target as HTMLInputElement).style.boxShadow = "none";
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

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
