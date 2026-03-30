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
  onClose,
}: LeftElementsPanelProps) {
  if (!panelState.open) {
    return null;
  }

  return (
    <aside className="elements-toolbar">
      <div className="mb-2 flex justify-center">
        <button className="elements-close-button" onClick={onClose} aria-label="Close elements">
          x
        </button>
      </div>
      <div className="grid gap-2">
        {(Object.keys(ELEMENT_LABELS) as ElementType[]).map((type) => {
          const Icon = ELEMENT_ICONS[type];
          return (
            <button
              key={type}
              onClick={() => onSpawnElement(type)}
              className="elements-tool-button"
              aria-label={ELEMENT_LABELS[type]}
              title={ELEMENT_LABELS[type]}
            >
              <Icon className="h-5 w-5 text-white" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
