"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type Dir = "up" | "down" | "left" | "right";

interface Options {
  /** Only the active screen should listen. */
  enabled?: boolean;
  initial?: string;
  onEnter?: (id: string) => void;
  onBack?: () => void;
  /** Return true to consume an arrow key (e.g. a slider using left/right). */
  onArrow?: (dir: Dir, id: string) => boolean | void;
}

const KEYS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
const BACK_KEYS = new Set(["Escape", "Backspace", "GoBack", "BrowserBack"]);

/**
 * D-pad focus manager: arrow keys move between ids laid out as rows,
 * Enter activates, Escape/Backspace goes back. One focused id at a time.
 */
export function useFocusGrid(grid: string[][], opts: Options = {}) {
  const { enabled = true, initial } = opts;
  const layoutKey = grid.map((r) => r.join("|")).join("/");
  const [focus, setFocus] = useState<string>(initial ?? grid[0]?.[0] ?? "");

  const live = useRef({ grid, focus, opts });
  live.current = { grid, focus, opts };

  // New screen state => new focus target.
  useEffect(() => {
    setFocus(initial ?? grid[0]?.[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const { grid, focus, opts } = live.current;
      const dir = KEYS[e.key];

      if (dir) {
        e.preventDefault();
        if (opts.onArrow?.(dir, focus)) return;
        const r = grid.findIndex((row) => row.includes(focus));
        if (r < 0) return;
        const c = grid[r].indexOf(focus);
        let nr = r;
        let nc = c;
        if (dir === "up") nr = Math.max(0, r - 1);
        if (dir === "down") nr = Math.min(grid.length - 1, r + 1);
        if (dir === "left") nc = Math.max(0, c - 1);
        if (dir === "right") nc = Math.min(grid[r].length - 1, c + 1);
        if (nr !== r) nc = Math.min(nc, grid[nr].length - 1);
        setFocus(grid[nr][nc]);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!e.repeat) opts.onEnter?.(focus);
      } else if (BACK_KEYS.has(e.key)) {
        e.preventDefault();
        if (!e.repeat) opts.onBack?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  const is = useCallback((id: string) => focus === id, [focus]);
  return { focus, setFocus, is };
}
