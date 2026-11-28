import {
  createContext,
  useCallback,
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
import { deleteAttachmentFiles, restoreEverything } from "./attachments";
import type { Account, Auth } from "./authAdapter";
import { backupErrorText, createBackups, type Backup, type Backups } from "./backups";
import { deviceAuth } from "./deviceAuth";
import { deviceFileStorage } from "./deviceFileStorage";
import { deviceRemote } from "./deviceRemote";
import type { FileStorage } from "./fileStorage";
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
  /** The account's Attachment files, while signed in. */
  attachmentStorage: FileStorage | null;
  /** The account's Backups, while signed in. */
  backups: Backups | null;
  backupStatus: BackupStatus;
  /** Runs a backup step, showing its outcome in `backupStatus`. */
  runBackups: (step: (backups: Backups) => Promise<Backup[]>) => Promise<void>;
}

/** What Settings → Data shows about Backups. */
export interface BackupStatus {
  /** Newest first; null until they have been listed since signing in. */
  list: Backup[] | null;
  busy: boolean;
  /** Why the last backup step failed, or null. */
  error: string | null;
}

const noBackups: BackupStatus = { list: null, busy: false, error: null };

/**
 * Deletes the files of Attachments this device removed, when it can: signed in, and
 * online. Files it can't delete now stay in Storage (M3-05).
 */
function cleanUp(
  storage: FileStorage | null,
  removed: Parameters<typeof deleteAttachmentFiles>[1],
) {
  if (removed.length) void deleteAttachmentFiles(storage, removed);
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
  const attachmentStorage = useMemo(
    () => (account ? deviceFileStorage("attachments") : null),
    [account],
  );
  const backups = useMemo(
    () =>
      app && account
        ? createBackups({
            storage: deviceFileStorage("backups"),
            userId: account.id,
            exportText: () => JSON.stringify(app.exportAll(), null, 2),
          })
        : null,
    [app, account],
  );
  const [backupStatus, setBackupStatus] = useState<BackupStatus>(noBackups);
  // The backups of the account signed in now, so a step that finishes after signing out
  // or into another account shows nothing.
  const currentBackups = useRef<Backups | null>(null);
  currentBackups.current = backups;
  const runBackups = useCallback(async (step: (b: Backups) => Promise<Backup[]>) => {
    const running = currentBackups.current;
    if (!running) return;
    setBackupStatus((s) => ({ ...s, busy: true, error: null }));
    try {
      const list = await step(running);
      if (currentBackups.current === running) setBackupStatus({ list, busy: false, error: null });
    } catch (error) {
      console.warn("Backup failed", error);
      if (currentBackups.current === running) {
        setBackupStatus((s) => ({ ...s, busy: false, error: backupErrorText(error) }));
      }
    }
  }, []);
  useEffect(() => {
    setBackupStatus(noBackups);
  }, [backups]);

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
      const expired = created.purgeExpiredTrash();
      cleanUp(restored && deviceFileStorage("attachments"), expired);
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
      cleanUp(attachmentStorage, app.purgeExpiredTrash());
      setVersion((v) => v + 1);
    }, 30_000);
    return () => clearInterval(timer);
  }, [app, attachmentStorage]);

  // Sync while signed in: at sign-in and start-up, on coming to the foreground, shortly
  // after a change here, and every 30 seconds in the foreground. Signed out, none of it.
  useEffect(() => {
    if (!app || !account) return;
    const running = createSyncer(app, deviceRemote(account), { onStatus: setSyncStatus });
    syncer.current = running;
    const sync = () => void running.sync();
    // On opening and coming to the foreground, a Backup check follows a successful sync,
    // so the Backup holds other devices' latest edits too (M3-08).
    let stopped = false;
    const syncThenBackUp = () =>
      void running.sync().then((result) => {
        if (result && !stopped) void runBackups((b) => b.check());
      });
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
      if (state === "active") syncThenBackUp();
    });
    syncThenBackUp();
    return () => {
      stopped = true;
      running.stop();
      if (syncer.current === running) syncer.current = null;
      onChange.current = () => {};
      clearTimeout(changeTimer);
      clearInterval(poll);
      foreground.remove();
      setSyncStatus({ kind: "notYet" });
    };
  }, [app, account, syncRun, runBackups]);

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
        attachmentStorage,
        backups,
        backupStatus,
        runBackups,
      },
    [app, version, auth, account, syncStatus, attachmentStorage, backups, backupStatus, runBackups],
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

/**
 * The account's Attachment files: null while signed out. `unavailable` says why
 * Attachments can't be added or opened now ("Sign in to add attachments", "You're
 * offline"), or is null when they can.
 */
export function useAttachmentStorage(): {
  storage: FileStorage | null;
  unavailable: string | null;
} {
  const state = useContext(Context);
  if (!state) throw new Error("useAttachmentStorage must be used inside MyThingsProvider");
  const { attachmentStorage, syncStatus } = state;
  return {
    storage: attachmentStorage,
    unavailable: !attachmentStorage
      ? "Sign in to add attachments"
      : syncStatus.kind === "offline"
        ? "You're offline"
        : null,
  };
}

/**
 * The account's Backups for Settings → Data: null while signed out. Restoring one
 * replaces everything through the export's restore, so it syncs to other devices.
 */
export function useBackups() {
  const state = useContext(Context);
  if (!state) throw new Error("useBackups must be used inside MyThingsProvider");
  const { app, backups, backupStatus, runBackups, attachmentStorage } = state;
  if (!backups) return null;
  return {
    ...backupStatus,
    backUpNow: () => runBackups((b) => b.backUpNow()),
    /** Replaces everything with the backup. Throws a StorageError or a RestoreError. */
    async restore(backup: Backup) {
      const text = await backups.read(backup);
      void restoreEverything(app, attachmentStorage, text);
    },
  };
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
