"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-me";

const MAP = { SYSTEM: "system", LIGHT: "light", DARK: "dark" } as const;
const FLAG = "tj-theme-synced";

/**
 * Applies the theme saved in the user's profile once per browser session, so the preference
 * follows them to new devices. After that, the local toggle wins (next-themes persists it).
 */
export function ThemeSync() {
  const { data: me } = useMe();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!me) return;
    try {
      if (sessionStorage.getItem(FLAG)) return;
      sessionStorage.setItem(FLAG, "1");
    } catch {
      return;
    }
    const wanted = MAP[me.theme];
    if (wanted && wanted !== theme) setTheme(wanted);
  }, [me, theme, setTheme]);

  return null;
}
