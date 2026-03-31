import type { PanelVisibilityState } from "../types";

const PANEL_LABELS: Record<keyof PanelVisibilityState, string> = {
  left: "Elements",
  right: "Inspector",
  variables: "Variables",
};

interface PanelToggleBarProps {
  panelVisibility: PanelVisibilityState;
  onOpenPanel: (panel: keyof PanelVisibilityState) => void;
  onCreateVariable: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  visible: boolean;
  onHide: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

export function PanelToggleBar({
  panelVisibility,
  onOpenPanel,
  onCreateVariable,
  theme,
  onToggleTheme,
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

        {/* Primary action */}
        <button className="topbar-btn accent" onClick={onCreateVariable} id="btn-add-variable">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Variable
        </button>

        <div className="topbar-sep" />

        {/* Theme toggle */}
        <button className="topbar-btn icon-only" onClick={onToggleTheme} title={theme === "light" ? "Dark mode" : "Light mode"} id="btn-toggle-theme">
          {theme === "light" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          )}
        </button>

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
