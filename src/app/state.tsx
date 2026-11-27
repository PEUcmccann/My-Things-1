import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { randomUUID } from "expo-crypto";
import { LayoutAnimation, Platform } from "react-native";
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
    loadDeviceStore(() => {
      // Rows slide into place as lists change (iPhone and Android).
      if (Platform.OS !== "web")
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setVersion((v) => v + 1);
    }).then((store) => {
      if (cancelled) return;
      const created = createMyThings({ clock: systemClock, store, newEditId: randomUUID });
      created.purgeExpiredTrash();
      setApp(created);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // When the date changes while the app is open, lists move on a day and old
  // Trash items expire.
  useEffect(() => {
    if (!app) return;
    let day = app.currentDate();
    const timer = setInterval(() => {
      if (app.currentDate() === day) return;
      day = app.currentDate();
      app.purgeExpiredTrash();
      setVersion((v) => v + 1);
    }, 30_000);
    return () => clearInterval(timer);
  }, [app]);

  if (!app) return <>{loading}</>;
  return <Context.Provider value={{ app, version }}>{children}</Context.Provider>;
}

/** The core, for screens. Re-renders the caller after every change. */
export function useMyThings(): MyThings {
  const state = useContext(Context);
  if (!state) throw new Error("useMyThings must be used inside MyThingsProvider");
  return state.app;
}

/** The core, or null while it is still loading. */
export function useOptionalMyThings(): MyThings | null {
  return useContext(Context)?.app ?? null;
}
