"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";
/** Görünüm stili: renk paleti, yazı tipi ve yüzeyler. Açık/koyu tercihinden bağımsızdır. */
export type StylePref = "classic" | "modern" | "glass" | "minimal";

const KEY = "gri:theme";
const STYLE_KEY = "gri:style";
export const STYLES: StylePref[] = ["classic", "modern", "glass", "minimal"];

/** Tarayıcı çubuğu rengi (her stilin arka planı) */
const COLORS: Record<StylePref, { light: string; dark: string }> = {
  classic: { light: "#e8e7e3", dark: "#0c0c0d" },
  modern: { light: "#eef1f6", dark: "#0b0f19" },
  glass: { light: "#e9e7fb", dark: "#120f2e" },
  minimal: { light: "#ffffff", dark: "#0a0a0a" },
};

/** İlk boyamadan önce çalışır; tema ve stil yanıp sönmesini (FOUC) engeller. */
export const THEME_SCRIPT = `(function(){try{var e=document.documentElement;var t=localStorage.getItem("${KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);e.dataset.theme=d?"dark":"light";var s=localStorage.getItem("${STYLE_KEY}");if(s&&s!=="classic"&&${JSON.stringify(STYLES)}.indexOf(s)>0)e.dataset.style=s}catch(x){}})()`;

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
const readPref = () => read<ThemePref>(KEY, ["system", "light", "dark"], "system");
const readStyle = () => read<StylePref>(STYLE_KEY, STYLES, "classic");

function apply(pref: ThemePref, style: StylePref) {
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = dark ? "dark" : "light";
  const root = document.documentElement;
  root.dataset.theme = theme;
  if (style === "classic") delete root.dataset.style;
  else root.dataset.style = style;
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((m) => (m.content = COLORS[style][theme]));
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* gizli sekme vb. */
  }
}

type ThemeApi = {
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  style: StylePref;
  setStyle: (s: StylePref) => void;
};

const ThemeContext = createContext<ThemeApi>({
  pref: "system",
  setPref: () => {},
  style: "classic",
  setStyle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [style, setStyleState] = useState<StylePref>("classic");

  useEffect(() => {
    const p = readPref();
    const s = readStyle();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage yalnızca istemcide okunabilir
    setPrefState(p);
    setStyleState(s);
    apply(p, s);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => readPref() === "system" && apply("system", readStyle());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setPref = useCallback(
    (p: ThemePref) => {
      store(KEY, p === "system" ? null : p);
      setPrefState(p);
      apply(p, style);
    },
    [style],
  );

  const setStyle = useCallback(
    (s: StylePref) => {
      store(STYLE_KEY, s === "classic" ? null : s);
      setStyleState(s);
      apply(pref, s);
    },
    [pref],
  );

  return <ThemeContext.Provider value={{ pref, setPref, style, setStyle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
