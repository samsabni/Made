import type React from "react";
import { useRef } from "react";
import { Input } from "@heroui/react";
import { motion } from "framer-motion";
import { GRID_SIZE } from "../constants";
import { renderBoundText } from "../utils/bindings";
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

/**
 * Renders a fixed static stage. All coordinates are local to the visible canvas.
 */
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

  /**
   * Converts screen coordinates into local stage coordinates.
   * @param clientX - pointer x in viewport space
   * @param clientY - pointer y in viewport space
   * @returns stage-local point used by drag, selection, and drop math
   */
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
    <div className="relative h-full w-full overflow-hidden bg-[#f5f3ef]">
      <div
        ref={viewportRef}
        className="canvas-viewport"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(120,113,108,0.14) 1px, transparent 0)`,
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        }}
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
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-stone-400">
            Drag an element or click to add
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
                onPointerMove={(event) => onElementPointerMove(toWorldPoint(event.clientX, event.clientY), event)}
                onPointerUp={(event) =>
                  onElementPointerUp(element.id, toWorldPoint(event.clientX, event.clientY), event)
                }
                onClick={(event) => onElementClick(element.id, event)}
              >
                {element.type === "button" && (
                  <motion.button
                    className="canvas-button"
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: "spring", stiffness: 520, damping: 28, mass: 0.45 }}
                  >
                    {renderBoundText(element.text, variables)}
                  </motion.button>
                )}
                {element.type === "text" && (
                  <div className="canvas-text">{renderBoundText(element.text, variables)}</div>
                )}
                {element.type === "panel" && (
                  <div className="canvas-panel">
                    <div className="text-sm font-medium text-stone-900">{renderBoundText(element.text, variables)}</div>
                  </div>
                )}
                {element.type === "group" && (
                  <div className="canvas-group">
                    <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{element.name}</div>
                  </div>
                )}
                {element.type === "input" && (
                  <div
                    className="pointer-events-auto h-full w-full"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Input
                      size="sm"
                      radius="sm"
                      classNames={{
                        inputWrapper: "border border-stone-200 bg-white shadow-none rounded-xl",
                        input: "text-stone-900",
                      }}
                      value={element.text}
                      onValueChange={(value) => onInputValueChange(element.id, value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        {selectionBox && (
          <div
            className="pointer-events-none absolute border border-sky-400/80 bg-sky-400/10"
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
