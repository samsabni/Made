import { describe, expect, it } from "vitest";
import { THEME_OPTIONS, isThemeMode } from "./theme";

describe("theme", () => {
  it("accepts the supported theme ids", () => {
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("midnight")).toBe(true);
    expect(isThemeMode("tokyo")).toBe(true);
    expect(isThemeMode("dracula")).toBe(true);
    expect(isThemeMode("nord")).toBe(true);
  });

  it("rejects removed dark themes", () => {
    expect(isThemeMode("graphite")).toBe(false);
    expect(isThemeMode("forest")).toBe(false);
  });

  it("exposes the theme options in settings order", () => {
    expect(THEME_OPTIONS.map((option) => option.value)).toEqual([
      "light",
      "midnight",
      "tokyo",
      "dracula",
      "nord",
    ]);
  });
});
