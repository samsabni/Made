import type { EditorMode, PanelVisibilityState } from "../types";

const PANEL_LABELS: Record<keyof PanelVisibilityState, string> = {
  left: "Elements",
  right: "Inspector",
  variables: "Variables",
};

interface PanelToggleBarProps {
  panelVisibility: PanelVisibilityState;
  onOpenPanel: (panel: keyof PanelVisibilityState) => void;
  mode: EditorMode;
  onEnterPreview: () => void;
  onExitPreview: () => void;
  onResetPreview: () => void;
  visible: boolean;
  onHide: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

export function PanelToggleBar({
  panelVisibility,
  onOpenPanel,
  mode,
  onEnterPreview,
  onExitPreview,
  onResetPreview,
  visible,
  onHide,
  settingsOpen,
  onToggleSettings,
}: PanelToggleBarProps) {
  const hiddenPanels = (Object.keys(panelVisibility) as Array<keyof PanelVisibilityState>).filter(
    (panel) => !panelVisibility[panel].open,
  );

  return (
    <div className={`topbar ${visible ? "" : "topbar-hidden"}`}>
      <div className="topbar-inner">
        {/* Brand */}
        <span className="topbar-badge" style={{ paddingLeft: 12 }}>Made</span>
        <div className="topbar-sep" />

        {mode === "edit" ? (
          <>
            <button className="topbar-btn accent" onClick={onEnterPreview} id="btn-enter-preview">
              Preview
            </button>
          </>
        ) : (
          <>
            <button className="topbar-btn accent" onClick={onExitPreview} id="btn-exit-preview">
              Stop preview
            </button>
            <button className="topbar-btn" onClick={onResetPreview} id="btn-reset-preview">
              Reset
            </button>
          </>
        )}

        <div className="topbar-sep" />

        <button
          className={`topbar-btn ${settingsOpen ? "active" : ""}`}
          onClick={onToggleSettings}
          id="btn-toggle-settings"
        >
          Settings
        </button>

        {/* Restore hidden panels */}
        {hiddenPanels.length > 0 && (
          <>
            <div className="topbar-sep" />
            {hiddenPanels.map((panel) => (
              <button
                key={panel}
                className="topbar-btn"
                onClick={() => onOpenPanel(panel)}
                id={`btn-open-${panel}`}
              >
                {PANEL_LABELS[panel]}
              </button>
            ))}
          </>
        )}

        <div className="topbar-sep" />
        <button
          className="topbar-btn icon-only"
          onClick={onHide}
          title="Hide toolbar"
          aria-label="Hide toolbar"
          id="btn-hide-topbar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15 12 9l-6 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
