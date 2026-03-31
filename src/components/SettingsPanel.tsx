interface SettingsPanelProps {
  open: boolean;
  onExport: () => void;
  onImport: () => void;
}

export function SettingsPanel({ open, onExport, onImport }: SettingsPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="settings-popover">
      <div className="settings-popover-header">
        <span className="side-panel-title">Settings</span>
      </div>
      <div className="settings-popover-body">
        <button className="btn" onClick={onExport} id="btn-export">
          Export project
        </button>
        <button className="btn" onClick={onImport} id="btn-import">
          Import project
        </button>
      </div>
    </div>
  );
}
