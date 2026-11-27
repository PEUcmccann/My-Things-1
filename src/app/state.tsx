import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { randomUUID } from "expo-crypto";
import { AppState, LayoutAnimation, Platform } from "react-native";
import { createMyThings, systemClock, type MyThings } from "../core";
import * as flow from "./account";
import type { Account, Auth } from "./authAdapter";
import { deviceAuth } from "./deviceAuth";
import { deviceRemote } from "./deviceRemote";
import { loadDeviceStore } from "./storage";
import { createSyncer, type Syncer, type SyncStatus } from "./syncer";

/** How long after the last change here a sync starts. */
const changeDelayMs = 2000;
/** How often a sync runs while the app is open and in the foreground. */
const pollMs = 30_000;

interface MyThingsState {
  app: MyThings;
  /** Goes up after every change, so screens re-read their lists. */
  version: number;
  auth: Auth;
  /** The signed-in account, or null while signed out. */
  account: Account | null;
  setAccount: (account: Account | null) => void;
  syncStatus: SyncStatus;
  /** The running syncer, while signed in. */
  syncer: { current: Syncer | null };
  /** Starts syncing again after a sign-out that failed. */
  restartSync: () => void;
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ kind: "notYet" });
  const [syncRun, setSyncRun] = useState(0);
  const syncer = useRef<Syncer | null>(null);
  // Called after every change to the records, by the store; the sync effect sets it.
  const onChange = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    loadDeviceStore(() => {
      // Rows slide into place as lists change (iPhone and Android).
      if (Platform.OS !== "web")
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setVersion((v) => v + 1);
      onChange.current();
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

  // Sync while signed in: at sign-in and start-up, on coming to the foreground, shortly
  // after a change here, and every 30 seconds in the foreground. Signed out, none of it.
  useEffect(() => {
    if (!app || !account) return;
    const running = createSyncer(app, deviceRemote(account), { onStatus: setSyncStatus });
    syncer.current = running;
    const sync = () => void running.sync();
    let changeTimer: ReturnType<typeof setTimeout> | undefined;
    onChange.current = () => {
      if (running.isWriting()) return;
      clearTimeout(changeTimer);
      changeTimer = setTimeout(sync, changeDelayMs);
    };
    const poll = setInterval(() => {
      if (AppState.currentState === "active") sync();
    }, pollMs);
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    sync();
    return () => {
      running.stop();
      if (syncer.current === running) syncer.current = null;
      onChange.current = () => {};
      clearTimeout(changeTimer);
      clearInterval(poll);
      foreground.remove();
      setSyncStatus({ kind: "notYet" });
    };
  }, [app, account, syncRun]);

  const value = useMemo(
    () =>
      app && {
        app,
        version,
        auth,
        account,
        setAccount,
        syncStatus,
        syncer,
        restartSync: () => setSyncRun((n) => n + 1),
      },
    [app, version, auth, account, syncStatus],
  );

  if (!value) return <>{loading}</>;
  return <Context.Provider value={value}>{children}</Context.Provider>;
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
 * the Owner of the records (account.ts), and start and stop sync.
 */
export function useAccount() {
  const state = useContext(Context);
  if (!state) throw new Error("useAccount must be used inside MyThingsProvider");
  const { app, auth, account, setAccount, syncer, restartSync } = state;
  return useMemo(() => {
    async function signOut() {
      // Stop first, so a sync under way can't bring records back after the erase.
      syncer.current?.stop();
      try {
        await flow.signOut(app, auth);
      } catch (error) {
        restartSync();
        throw error;
      }
      setAccount(null);
    }
    return {
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
      signOut,
      /** Syncs, then signs out if everything was sent. Returns false if it wasn't. */
      async syncAndSignOut(): Promise<boolean> {
        await syncer.current?.sync();
        if (app.unsentEdits().length > 0) return false;
        await signOut();
        return true;
      },
    };
  }, [app, auth, account, setAccount, syncer, restartSync]);
}

/** Sync's status for Settings, and a way to sync now. */
export function useSync() {
  const state = useContext(Context);
  if (!state) throw new Error("useSync must be used inside MyThingsProvider");
  const { app, syncStatus, syncer } = state;
  return {
    status: syncStatus,
    syncNow: () => syncer.current?.sync(),
    /** How many changes here haven't been sent to the account yet. */
    unsentCount: () => app.unsentEdits().length,
  };
}
