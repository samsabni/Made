export type ThemeMode = "light" | "midnight" | "tokyo" | "dracula" | "nord";

export const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Light" },
  { value: "midnight", label: "Midnight" },
  { value: "tokyo", label: "Tokyo Night" },
  { value: "dracula", label: "Dracula" },
  { value: "nord", label: "Nord" },
];

export function isThemeMode(value: string): value is ThemeMode {
  return THEME_OPTIONS.some((option) => option.value === value);
}
