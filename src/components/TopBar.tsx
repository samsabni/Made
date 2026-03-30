import { Button } from "@heroui/react";
import type { PanelVisibilityState } from "../types";

interface TopBarProps {
  panelVisibility: PanelVisibilityState;
  onTogglePanel: (panel: keyof PanelVisibilityState, mode: "open" | "minimize") => void;
  onCreateVariable: () => void;
}

export function TopBar({ panelVisibility, onTogglePanel, onCreateVariable }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/10 bg-slate-950/85 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-slate-100">
          MadeGame
        </div>
        <div className="text-xs text-slate-400">Live text game maker</div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" color="primary" variant="flat" onPress={onCreateVariable}>
          Add variable
        </Button>
        {(["left", "right", "variables"] as const).map((panel) => (
          <Button
            key={panel}
            size="sm"
            variant={panelVisibility[panel].open ? "flat" : "bordered"}
            onPress={() => onTogglePanel(panel, "open")}
          >
            {panel}
          </Button>
        ))}
      </div>
    </header>
  );
}
