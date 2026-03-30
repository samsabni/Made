import { Button } from "@heroui/react";
import type { PanelVisibilityState } from "../types";

interface PanelToggleBarProps {
  panelVisibility: PanelVisibilityState;
  onOpenPanel: (panel: keyof PanelVisibilityState) => void;
  onCreateVariable: () => void;
  onExport: () => void;
  onImport: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function PanelToggleBar({
  panelVisibility,
  onOpenPanel,
  onCreateVariable,
  onExport,
  onImport,
  theme,
  onToggleTheme,
}: PanelToggleBarProps) {
  const hiddenPanels = (Object.keys(panelVisibility) as Array<keyof PanelVisibilityState>).filter(
    (panel) => !panelVisibility[panel].open,
  );

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2">
      <div className="toolbar-surface pointer-events-auto flex gap-1.5 border border-stone-200 bg-white/92 p-1.5 shadow-[0_10px_30px_rgba(17,24,39,0.08)] backdrop-blur">
        <Button size="sm" color="primary" variant="flat" onPress={onCreateVariable}>
          Add variable
        </Button>
        <Button size="sm" variant="light" onPress={onToggleTheme}>
          {theme === "light" ? "Dark mode" : "Light mode"}
        </Button>
        <Button size="sm" variant="light" onPress={onExport}>
          Export
        </Button>
        <Button size="sm" variant="light" onPress={onImport}>
          Import
        </Button>
        {hiddenPanels.map((panel) => (
          <Button key={panel} size="sm" variant="flat" onPress={() => onOpenPanel(panel)}>
            Open {panel}
          </Button>
        ))}
      </div>
    </div>
  );
}
