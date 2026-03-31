interface SettingsPanelProps {
  open: boolean;
  snapToGrid: boolean;
  onToggleSnapToGrid: (checked: boolean) => void;
  onExport: () => void;
  onImport: () => void;
}

export function SettingsPanel({
  open,
  snapToGrid,
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
          />
        </label>

        <div className="settings-actions">
          <button className="btn" onClick={onExport} id="btn-export">
            Export project
          </button>
          <button className="btn" onClick={onImport} id="btn-import">
            Import project
          </button>
        </div>
      </div>
    </div>
  );
}
