import {
  RectangleStackIcon,
  CursorArrowRippleIcon,
  Bars3BottomLeftIcon,
  Square2StackIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { ELEMENT_LABELS } from "../constants";
import type { ElementType, PanelState } from "../types";

interface LeftElementsPanelProps {
  panelState: PanelState;
  onSpawnElement: (type: ElementType) => void;
  onBeginDrag: (type: ElementType) => void;
  onEndDrag: () => void;
  disabled?: boolean;
  onClose: () => void;
}

const ELEMENT_ICONS: Record<ElementType, React.ComponentType<React.ComponentProps<"svg">>> = {
  button: CursorArrowRippleIcon,
  text: Bars3BottomLeftIcon,
  panel: RectangleStackIcon,
  group: Square2StackIcon,
  input: ChatBubbleLeftRightIcon,
};

export function LeftElementsPanel({
  panelState,
  onSpawnElement,
  onBeginDrag,
  onEndDrag,
  disabled = false,
  onClose,
}: LeftElementsPanelProps) {
  if (!panelState.open) {
    return null;
  }

  return (
    <aside className="elements-toolbar">
      <button
        className="elements-close-btn"
        onClick={onClose}
        aria-label="Close elements panel"
        title="Close"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>

      <div className="elements-toolbar-divider" />

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {(Object.keys(ELEMENT_LABELS) as ElementType[]).map((type) => {
          const Icon = ELEMENT_ICONS[type];
          return (
            <button
              key={type}
              onClick={() => onSpawnElement(type)}
              className="elements-tool-btn"
              aria-label={ELEMENT_LABELS[type]}
              title={ELEMENT_LABELS[type]}
              id={`tool-${type}`}
              disabled={disabled}
              draggable={!disabled}
              onDragStart={() => onBeginDrag(type)}
              onDragEnd={onEndDrag}
            >
              <Icon className="h-[17px] w-[17px]" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
