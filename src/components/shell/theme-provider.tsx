"use client";

import type { ReactNode } from "react";
import { getThemeById, getThemeCssVars } from "@/lib/workspace/themes";

export function ShellThemeProvider({
  themeId,
  children,
}: {
  themeId: string;
  children: ReactNode;
}) {
  const theme = getThemeById(themeId);
  const cssVars = getThemeCssVars(theme);

  return (
    <div style={cssVars as React.CSSProperties} data-theme={themeId}>
      {children}
    </div>
  );
}
