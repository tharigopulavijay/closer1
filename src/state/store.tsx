import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { blankState } from "./logic";
import type { AppState } from "../lib/types";

const KEY = "closer.v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1 || !parsed.draft || !parsed.streak) return blankState();
    return parsed;
  } catch {
    return blankState();
  }
}

type Store = {
  state: AppState;
  current: () => AppState;
  commit: (next: AppState) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
    document.title = state.discreet ? "Notes" : "Closer";
  }, [state]);

  const api = useMemo<Pick<Store, "current" | "commit">>(
    () => ({
      current: () => ref.current,
      commit: (next) => {
        ref.current = next;
        setState(next);
      },
    }),
    [],
  );

  return <Ctx.Provider value={{ state, ...api }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error("Closer store is missing");
  return store;
}
