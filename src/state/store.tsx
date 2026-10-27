import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { sessionToken } from "../lib/api";
import type { AppState } from "../lib/types";
import { blankState } from "./logic";
import { isLive, refresh } from "./live";

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
  /** False only in live mode while the first account refresh is in flight. */
  loaded: boolean;
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

  // In live mode nothing is known about the account until the first refresh lands,
  // so screens wait for it instead of judging a verified member as unverified.
  const [loaded, setLoaded] = useState(() => !isLive() || !sessionToken());

  useEffect(() => {
    if (!isLive() || !sessionToken()) return;
    void refresh(ref.current)
      .then((next) => {
        ref.current = next;
        setState(next);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

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

  return <Ctx.Provider value={{ state, loaded, ...api }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error("Closer store is missing");
  return store;
}
