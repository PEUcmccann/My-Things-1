import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createMyThings, systemClock, type MyThings } from "../core";
import { loadDeviceStore } from "./storage";

interface MyThingsState {
  app: MyThings;
  /** Goes up after every change, so screens re-read their lists. */
  version: number;
}

const Context = createContext<MyThingsState | null>(null);

export function MyThingsProvider({
  children,
  loading,
}: {
  children: ReactNode;
  loading: ReactNode;
}) {
  const [app, setApp] = useState<MyThings | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadDeviceStore(() => setVersion((v) => v + 1)).then((store) => {
      if (!cancelled) setApp(createMyThings({ clock: systemClock, store }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!app) return <>{loading}</>;
  return <Context.Provider value={{ app, version }}>{children}</Context.Provider>;
}

/** The core, for screens. Re-renders the caller after every change. */
export function useMyThings(): MyThings {
  const state = useContext(Context);
  if (!state) throw new Error("useMyThings must be used inside MyThingsProvider");
  return state.app;
}
