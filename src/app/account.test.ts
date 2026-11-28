import { describe, expect, it } from "vitest";
import { createMyThings, fixedClock, localOwner, memoryStore, type MyThings } from "../core";
import {
  cancelSignIn,
  finishSignIn,
  restoreAccount,
  signIn,
  signOut,
  syncAndSignOut,
} from "./account";
import { fakeAuth, fakeCode, memoryStorage, type Auth } from "./authAdapter";
import { fakeRemote, memorySyncStorage, SyncError, type Remote } from "./remote";
import { createSyncer } from "./syncer";

function setup() {
  const store = memoryStore();
  const clock = fixedClock("2026-11-26T10:00:00");
  const app = createMyThings({ clock, store });
  const storage = memoryStorage();
  return { app, auth: fakeAuth(storage), storage, store, clock };
}

const owners = (app: MyThings) =>
  new Set(Object.values(app.exportAll().records).flatMap((list) => list.map((r) => r.owner)));

async function signedInAs(app: MyThings, auth: Auth, email: string) {
  const result = await signIn(app, auth, email, fakeCode);
  if (result.kind === "confirmErase") finishSignIn(app, result.account);
  return result.account;
}

describe("signing in", () => {
  it("takes over the records made while signed out", async () => {
    const { app, auth } = setup();
    app.createToDo({ title: "Buy milk" });
    const result = await signIn(app, auth, "sam@example.com", fakeCode);
    expect(result.kind).toBe("signedIn");
    expect(owners(app)).toEqual(new Set([result.account.id]));
    expect(app.owner()).toBe(result.account.id);
  });

  it("asks first on a device holding another account's records, then erases them", async () => {
    const { app, auth } = setup();
    const first = await signedInAs(app, auth, "a@example.com");
    app.createToDo({ title: "A's To-do" });
    // Signed out elsewhere without erasing, as after a crash.
    await auth.signOut();
    const result = await signIn(app, auth, "b@example.com", fakeCode);
    expect(result.kind).toBe("confirmErase");
    // Nothing changes until the user confirms.
    expect(owners(app)).toEqual(new Set([first.id]));
    finishSignIn(app, result.account);
    expect(app.exportAll().records.toDos).toEqual([]);
    expect(app.owner()).toBe(result.account.id);
    expect((await auth.currentAccount())?.email).toBe("b@example.com");
  });

  it("keeps everything when the user doesn't confirm, and stays signed out", async () => {
    const { app, auth } = setup();
    const first = await signedInAs(app, auth, "a@example.com");
    app.createToDo({ title: "A's To-do" });
    await auth.signOut();
    await signIn(app, auth, "b@example.com", fakeCode);
    await cancelSignIn(auth);
    expect(owners(app)).toEqual(new Set([first.id]));
    expect(await auth.currentAccount()).toBeNull();
  });

  it("a wrong code changes nothing", async () => {
    const { app, auth } = setup();
    app.createToDo({ title: "Buy milk" });
    await expect(signIn(app, auth, "sam@example.com", "111111")).rejects.toMatchObject({
      kind: "wrongCode",
    });
    expect(owners(app)).toEqual(new Set([localOwner]));
  });
});

describe("restarting", () => {
  it("stays signed in, and new records belong to the account", async () => {
    const { app, auth, store, clock, storage } = setup();
    const account = await signedInAs(app, auth, "sam@example.com");
    const again = createMyThings({ clock, store: memoryStore(store.snapshot()) });
    expect(await restoreAccount(again, fakeAuth(storage))).toEqual(account);
    const id = again.createToDo({ title: "After a restart" });
    expect(again.getToDo(id).owner).toBe(account.id);
  });

  it("signs out a session whose account doesn't own the data here", async () => {
    const { app, auth } = setup();
    await signedInAs(app, auth, "a@example.com");
    app.createToDo({ title: "A's To-do" });
    await auth.signOut();
    // The app stopped between verifying B's code and the user's answer.
    await auth.verifyCode("b@example.com", fakeCode);
    expect(await restoreAccount(app, auth)).toBeNull();
    expect(await auth.currentAccount()).toBeNull();
    expect(app.exportAll().records.toDos).toHaveLength(1);
  });
});

describe("signing out", () => {
  it("erases this device and leaves it signed out with default settings", async () => {
    const { app, auth } = setup();
    await signedInAs(app, auth, "sam@example.com");
    app.createToDo({ title: "Buy milk" });
    app.setAccentColour("rose");
    await signOut(app, auth);
    expect(await auth.currentAccount()).toBeNull();
    expect(app.exportAll().records.toDos).toEqual([]);
    expect(app.accentColour()).toBe("teal");
    expect(app.owner()).toBe(localOwner);
  });
});

describe("syncing, then signing out", () => {
  /** A signed-in device syncing through a fake remote; `onSend` runs inside each send. */
  async function syncing(onSend: (app: MyThings) => void = () => {}) {
    const { app, auth } = setup();
    const account = await signedInAs(app, auth, "sam@example.com");
    const inner = fakeRemote(memorySyncStorage(), account.id);
    let online = true;
    const remote: Remote = {
      async send(edits) {
        if (!online) throw new SyncError("offline", "Failed to fetch");
        onSend(app);
        return inner.send(edits);
      },
      fetch: (after, offset, limit) => inner.fetch(after, offset, limit),
    };
    const syncer = createSyncer(app, remote);
    const sent = async () => (await inner.fetch(null, 0, 1000)).map((e) => e.value);
    return { app, auth, syncer, sent, goOffline: () => (online = false) };
  }

  it("sends everything, then erases this device and signs out", async () => {
    const { app, auth, syncer, sent } = await syncing();
    app.createToDo({ title: "Buy milk" });
    expect(await syncAndSignOut(app, auth, syncer)).toBe(true);
    expect(await sent()).toContain("Buy milk");
    expect(app.exportAll().records.toDos).toEqual([]);
    expect(await auth.currentAccount()).toBeNull();
  });

  it("also sends an edit made while the sync was under way", async () => {
    let edited = false;
    const { app, auth, syncer, sent } = await syncing((on) => {
      if (edited) return;
      edited = true;
      on.createToDo({ title: "Made during the sync" });
    });
    app.createToDo({ title: "Buy milk" });
    expect(await syncAndSignOut(app, auth, syncer)).toBe(true);
    expect(await sent()).toEqual(expect.arrayContaining(["Buy milk", "Made during the sync"]));
    expect(app.exportAll().records.toDos).toEqual([]);
  });

  it("asks again, erasing nothing, when edits keep arriving faster than they're sent", async () => {
    const { app, auth, syncer } = await syncing((on) => void on.createToDo({ title: "More" }));
    app.createToDo({ title: "Buy milk" });
    expect(await syncAndSignOut(app, auth, syncer)).toBe(false);
    expect(app.unsentEdits().length).toBeGreaterThan(0);
    expect(await auth.currentAccount()).not.toBeNull();
  });

  it("asks again, erasing nothing, when offline", async () => {
    const { app, auth, syncer, goOffline } = await syncing();
    app.createToDo({ title: "Buy milk" });
    goOffline();
    expect(await syncAndSignOut(app, auth, syncer)).toBe(false);
    expect(app.inbox().map((e) => e.toDo.title)).toEqual(["Buy milk"]);
    expect(await auth.currentAccount()).not.toBeNull();
  });

  it("keeps an edit made while signing out, as this device's own", async () => {
    const { app, auth, syncer } = await syncing();
    const slow: Auth = {
      ...auth,
      async signOut() {
        app.createToDo({ title: "Made while signing out" });
        await auth.signOut();
      },
    };
    expect(await syncAndSignOut(app, slow, syncer)).toBe(true);
    expect(app.inbox().map((e) => e.toDo.title)).toEqual(["Made while signing out"]);
    expect(owners(app)).toEqual(new Set([localOwner]));
  });

  it("stays the account's device when the session can't be ended", async () => {
    const { app, auth, syncer } = await syncing();
    const account = await auth.currentAccount();
    const failing: Auth = {
      ...auth,
      signOut: async () => {
        throw new Error("Failed to fetch");
      },
    };
    await expect(syncAndSignOut(app, failing, syncer)).rejects.toThrow("Failed to fetch");
    expect(app.owner()).toBe(account!.id);
  });
});
