import { SelectField } from "./FormControls";
import { THEME_OPTIONS, type ThemeMode } from "../utils/theme";

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

export function SettingsPanel({
  open,
  theme,
  snapToGrid,
  disabled = false,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
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
            options={THEME_OPTIONS}
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
          <button className="btn" onClick={onUndo} disabled={disabled || !canUndo}>
            Undo
          </button>
          <button className="btn" onClick={onRedo} disabled={disabled || !canRedo}>
            Redo
          </button>
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
