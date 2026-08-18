"use client";

/**
 * AURUM finish runtime.
 *
 * Five finishes, two of which are the light/dark defaults. The dark-mode
 * control toggles the default pair; the other three are chosen explicitly in
 * Settings. A theme change is a 320 ms cross-fade of the token layer only —
 * geometry, type and motion are identical across all five, so no layout
 * recalculates and nothing shifts by a single pixel.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export const FINISHES = [
  "black-titanium",
  "natural-titanium",
  "desert-gold",
  "white-titanium",
  "vapor-chrome",
] as const;

export type Finish = (typeof FINISHES)[number];

export const FINISH_META: Record<
  Finish,
  { name: string; mode: "dark" | "light"; role: string; note: string }
> = {
  "black-titanium": {
    name: "Black Titanium",
    mode: "dark",
    role: "Default · Dark",
    note: "The void with one warm light in it.",
  },
  "natural-titanium": {
    name: "Natural Titanium",
    mode: "light",
    role: "Default · Light",
    note: "Brushed paper-white with an engraved dark label.",
  },
  "desert-gold": {
    name: "Desert Gold",
    mode: "light",
    role: "Ceremonial · Light",
    note: "The one finish where gold may be the ground.",
  },
  "white-titanium": {
    name: "White Titanium",
    mode: "light",
    role: "High-key · Light",
    note: "No accent at all — hierarchy carried purely by type weight.",
  },
  "vapor-chrome": {
    name: "Vapor Chrome",
    mode: "dark",
    role: "Immersive · Dark",
    note: "Gold suspended; cold light carries the whole hierarchy.",
  },
};

/** The default pair the dark-mode control swaps between. */
const DARK_DEFAULT: Finish = "black-titanium";
const LIGHT_DEFAULT: Finish = "natural-titanium";

const STORAGE_KEY = "cdl.finish";

function isFinish(v: unknown): v is Finish {
  return typeof v === "string" && (FINISHES as readonly string[]).includes(v);
}

type ThemeContextValue = {
  finish: Finish;
  mode: "dark" | "light";
  setFinish: (f: Finish) => void;
  /** Swap the light/dark default pair, preserving a non-default finish's mode. */
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * `<html data-finish>` is the store.
 *
 * The bootstrap script writes the correct finish before first paint, so the DOM
 * already holds the truth by the time React hydrates. Mirroring it into React
 * state would mean a second source that has to be reconciled in an effect —
 * which is both a cascading render and a frame of the wrong theme. Instead the
 * attribute is subscribed to directly, and writing it is what triggers a
 * re-render.
 */
function subscribeToFinish(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-finish"],
  });
  return () => observer.disconnect();
}

function readFinishFromDom(): Finish {
  const value = document.documentElement.dataset.finish;
  return isFinish(value) ? value : DARK_DEFAULT;
}

function writeFinishToDom(next: Finish) {
  const root = document.documentElement;
  root.dataset.finish = next;
  root.style.colorScheme = FINISH_META[next].mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* non-fatal: the finish simply will not persist */
  }
}

export function ThemeProvider({
  children,
  initialFinish = DARK_DEFAULT,
}: {
  children: ReactNode;
  initialFinish?: Finish;
}) {
  const finish = useSyncExternalStore(
    subscribeToFinish,
    readFinishFromDom,
    () => initialFinish, // server snapshot — the bootstrap script corrects it
  );

  const setFinish = useCallback((f: Finish) => writeFinishToDom(f), []);

  const toggleMode = useCallback(() => {
    const current = readFinishFromDom();
    writeFinishToDom(
      FINISH_META[current].mode === "dark" ? LIGHT_DEFAULT : DARK_DEFAULT,
    );
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ finish, mode: FINISH_META[finish].mode, setFinish, toggleMode }),
    [finish, setFinish, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/**
 * Runs before paint so the correct finish is on <html> in the first frame.
 * Without this the app flashes the default finish — a flash of the wrong
 * theme is the most visible failure a token layer can have.
 */
export const themeBootstrapScript = `
(function(){
  try{
    var f = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var ok = ${JSON.stringify(FINISHES)}.indexOf(f) !== -1;
    if(!ok){
      f = matchMedia('(prefers-color-scheme: light)').matches
        ? ${JSON.stringify(LIGHT_DEFAULT)}
        : ${JSON.stringify(DARK_DEFAULT)};
    }
    var d = document.documentElement;
    d.dataset.finish = f;
    d.style.colorScheme = (f === ${JSON.stringify(DARK_DEFAULT)} || f === 'vapor-chrome') ? 'dark' : 'light';
  }catch(e){
    document.documentElement.dataset.finish = ${JSON.stringify(DARK_DEFAULT)};
  }
})();
`;
