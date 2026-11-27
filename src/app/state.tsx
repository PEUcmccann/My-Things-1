import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { randomUUID } from "expo-crypto";
import { LayoutAnimation, Platform } from "react-native";
import { createMyThings, systemClock, type MyThings } from "../core";
import * as flow from "./account";
import type { Account, Auth } from "./authAdapter";
import { deviceAuth } from "./deviceAuth";
import { loadDeviceStore } from "./storage";

interface MyThingsState {
  app: MyThings;
  /** Goes up after every change, so screens re-read their lists. */
  version: number;
  auth: Auth;
  /** The signed-in account, or null while signed out. */
  account: Account | null;
  setAccount: (account: Account | null) => void;
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
  const [auth] = useState(deviceAuth);
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDeviceStore(() => {
      // Rows slide into place as lists change (iPhone and Android).
      if (Platform.OS !== "web")
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setVersion((v) => v + 1);
    }).then(async (store) => {
      if (cancelled) return;
      const created = createMyThings({ clock: systemClock, store, newEditId: randomUUID });
      // The kept session sets the Owner before anything else is created.
      const restored = await flow.restoreAccount(created, auth).catch((error) => {
        console.warn("Could not read the sign-in session", error);
        return null;
      });
      if (cancelled) return;
      created.purgeExpiredTrash();
      setAccount(restored);
      setApp(created);
    });
    return () => {
      cancelled = true;
    };
  }, [auth]);

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
  return (
    <Context.Provider value={{ app, version, auth, account, setAccount }}>
      {children}
    </Context.Provider>
  );
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

/**
 * The signed-in account and the actions that change it. Signing in and out also change
 * the Owner of the records (account.ts). Sync (M3-04) starts and stops on `account`.
 */
export function useAccount() {
  const state = useContext(Context);
  if (!state) throw new Error("useAccount must be used inside MyThingsProvider");
  const { app, auth, account, setAccount } = state;
  return useMemo(
    () => ({
      account,
      sendCode: (email: string) => auth.sendCode(email),
      /** Checks the code. When it returns "confirmErase", ask, then finish or cancel. */
      async signIn(email: string, code: string): Promise<flow.SignInResult> {
        const result = await flow.signIn(app, auth, email, code);
        if (result.kind === "signedIn") setAccount(result.account);
        return result;
      },
      finishSignIn(next: Account) {
        flow.finishSignIn(app, next);
        setAccount(next);
      },
      cancelSignIn: () => flow.cancelSignIn(auth),
      async signOut() {
        await flow.signOut(app, auth);
        setAccount(null);
      },
    }),
    [app, auth, account, setAccount],
  );
}
