import { SelectField } from "./FormControls";

type ThemeMode = "light" | "midnight" | "graphite" | "forest";

interface SettingsPanelProps {
  open: boolean;
  theme: ThemeMode;
  snapToGrid: boolean;
  disabled?: boolean;
  onChangeTheme: (theme: ThemeMode) => void;
  onToggleSnapToGrid: (checked: boolean) => void;
  onExport: () => void;
  onImport: () => void;
}

export function SettingsPanel({
  open,
  theme,
  snapToGrid,
  disabled = false,
  onChangeTheme,
  onToggleSnapToGrid,
  onExport,
  onImport,
}: SettingsPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="settings-popover">
      <div className="settings-popover-arrow" />
      <div className="settings-popover-header">
        <div>
          <div className="side-panel-title">Workspace</div>
          <div className="settings-popover-subtitle">Editor behavior and project actions</div>
        </div>
      </div>
      <div className="settings-popover-body">
        <div className="settings-row settings-row-stack">
          <div className="settings-row-copy">
            <span className="settings-row-title">Theme</span>
            <span className="settings-row-description">Choose the editor color theme</span>
          </div>
          <SelectField
            label=""
            value={theme}
            onChange={(value) => onChangeTheme(value as ThemeMode)}
            disabled={disabled}
            options={[
              { value: "light", label: "Light" },
              { value: "midnight", label: "Midnight" },
              { value: "graphite", label: "Graphite" },
              { value: "forest", label: "Forest" },
            ]}
          />
        </div>

        <label className="settings-row">
          <div className="settings-row-copy">
            <span className="settings-row-title">Snap elements to grid</span>
            <span className="settings-row-description">Align new and moved elements to the canvas grid</span>
          </div>
          <input
            className="settings-toggle"
            type="checkbox"
            checked={snapToGrid}
            onChange={(event) => onToggleSnapToGrid(event.target.checked)}
            id="toggle-snap-grid"
            disabled={disabled}
          />
        </label>

        <div className="settings-actions">
          <button className="btn" onClick={onExport} id="btn-export" disabled={disabled}>
            Export project
          </button>
          <button className="btn" onClick={onImport} id="btn-import" disabled={disabled}>
            Import project
          </button>
        </div>
      </div>
    </div>
  );
}
