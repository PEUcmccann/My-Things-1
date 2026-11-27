import { describe, expect, it } from "vitest";
import { createMyThings, fixedClock, localOwner, memoryStore, type MyThings } from "../core";
import { cancelSignIn, finishSignIn, restoreAccount, signIn, signOut } from "./account";
import { fakeAuth, fakeCode, memoryStorage, type Auth } from "./authAdapter";

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
