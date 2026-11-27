import { describe, expect, it } from "vitest";
import { createMyThings, fixedClock, memoryStore, type MyThings, type SnapshotV1 } from "../core";
import { fakeRemote, memorySyncStorage, SyncError, type Remote, type SyncStorage } from "./remote";
import { createSyncer, fetchPage, sendBatch, syncStatusText, type SyncStatus } from "./syncer";

const owner = "00000000-0000-4000-8000-0000000000aa";

/** A remote whose requests can be made to fail, counting the calls. */
function controllable(remote: Remote) {
  const calls = { send: [] as number[], fetch: [] as (string | null)[] };
  let failing: SyncError | null = null;
  let failFetchAfter = Infinity;
  const wrapped: Remote = {
    async send(edits) {
      if (failing) throw failing;
      calls.send.push(edits.length);
      return remote.send(edits);
    },
    async fetch(after, offset, limit) {
      if (failing) throw failing;
      if (calls.fetch.length >= failFetchAfter) throw new SyncError("failed", "page lost");
      calls.fetch.push(after);
      return remote.fetch(after, offset, limit);
    },
  };
  return {
    remote: wrapped,
    calls,
    offline: (on: boolean) => (failing = on ? new SyncError("offline", "Failed to fetch") : null),
    failFetchAfter: (n: number) => (failFetchAfter = n),
  };
}

let serverTime = Date.parse("2026-11-27T10:00:00Z");

/** One device signed in to the account, syncing through a remote kept in `storage`. */
function device(n: number, storage: SyncStorage, snapshot?: SnapshotV1) {
  const clock = fixedClock("2026-11-27T10:00:00");
  let id = 0;
  let edit = 0;
  const store = memoryStore(snapshot);
  const app: MyThings = createMyThings({
    clock,
    store,
    newId: () => `${n}-id-${++id}`,
    newEditId: () => `${n}0000000-0000-4000-8000-${(++edit).toString(16).padStart(12, "0")}`,
  });
  app.changeOwner(owner);
  const remote = controllable(fakeRemote(storage, owner, () => serverTime));
  const statuses: SyncStatus[] = [];
  const syncer = createSyncer(app, remote.remote, {
    now: () => serverTime,
    onStatus: (s) => statuses.push(s),
  });
  return { app, clock, store, syncer, statuses, ...remote };
}

const titles = (app: MyThings) => app.inbox().map((e) => e.toDo.title);

describe("syncing two devices through one remote", () => {
  it("edits on one device reach the other", async () => {
    const storage = memorySyncStorage();
    const a = device(1, storage);
    const b = device(2, storage);
    a.app.createToDo({ title: "Buy milk" });
    await a.syncer.sync();
    expect(a.app.unsentEdits()).toEqual([]);
    await b.syncer.sync();
    expect(titles(b.app)).toEqual(["Buy milk"]);
    expect(b.statuses.map((s) => s.kind)).toEqual(["syncing", "synced"]);
  });

  it("edits made offline on both reach each other once both are back", async () => {
    const storage = memorySyncStorage();
    const a = device(1, storage);
    const b = device(2, storage);
    const id = a.app.createToDo({ title: "Buy milk" });
    await a.syncer.sync();
    await b.syncer.sync();
    a.offline(true);
    b.offline(true);
    a.clock.set("2026-11-27T10:01:00");
    a.app.editToDo(id, { title: "Buy oat milk" });
    b.clock.set("2026-11-27T10:02:00");
    b.app.setDeadline(id, "2026-11-30");
    b.app.createToDo({ title: "Call Sam" });
    await a.syncer.sync();
    await b.syncer.sync();
    expect(a.syncer.status()).toMatchObject({ kind: "offline" });
    a.offline(false);
    b.offline(false);
    serverTime += 60_000;
    await a.syncer.sync();
    await b.syncer.sync();
    await a.syncer.sync();
    for (const app of [a.app, b.app]) {
      expect(app.getToDo(id)).toMatchObject({ title: "Buy oat milk", deadline: "2026-11-30" });
      expect(titles(app).sort()).toEqual(["Buy oat milk", "Call Sam"]);
    }
  });

  it("a failed send keeps the edits for the next sync, and says why", async () => {
    const storage = memorySyncStorage();
    const a = device(1, storage);
    a.app.createToDo({ title: "Buy milk" });
    const failing: Remote = {
      send: async () => {
        throw new SyncError("failed", "permission denied for table edits");
      },
      fetch: async () => [],
    };
    const broken = createSyncer(a.app, failing, { now: () => serverTime });
    await broken.sync();
    expect(broken.status()).toMatchObject({
      kind: "failed",
      reason: "permission denied for table edits",
    });
    expect(a.app.unsentEdits().some((e) => e.value === "Buy milk")).toBe(true);
    await a.syncer.sync();
    const b = device(2, storage);
    await b.syncer.sync();
    expect(titles(b.app)).toEqual(["Buy milk"]);
  });

  it("fetches again from 2 minutes before the last edit seen, without applying anything twice", async () => {
    const storage = memorySyncStorage();
    const a = device(1, storage);
    const b = device(2, storage);
    a.app.createToDo({ title: "Buy milk" });
    await a.syncer.sync();
    const first = await b.syncer.sync();
    expect(first?.applied).toBeGreaterThan(0);
    const seen = b.app.lastReceivedAt()!;
    serverTime += 30_000;
    const again = await b.syncer.sync();
    expect(b.calls.fetch.at(-1)).toBe(new Date(Date.parse(seen) - 120_000).toISOString());
    expect(again?.fetched).toBeGreaterThan(0);
    expect(again?.applied).toBe(0);
  });

  it("sends in batches of 500 and fetches in pages of 1000, applying every page", async () => {
    const storage = memorySyncStorage();
    const a = device(1, storage);
    const b = device(2, storage);
    for (let i = 0; i < 60; i++) {
      const id = a.app.createToDo({ title: `To-do ${i}` });
      for (let c = 0; c < 2; c++) a.app.addChecklistItem(id, `Step ${c}`);
    }
    const unsent = a.app.unsentEdits().length;
    expect(unsent).toBeGreaterThan(2 * fetchPage);
    await a.syncer.sync();
    expect(a.calls.send.every((n) => n <= sendBatch)).toBe(true);
    expect(a.calls.send.reduce((x, y) => x + y, 0)).toBe(unsent + 2);
    await b.syncer.sync();
    const rows = (JSON.parse(storage.getItem(`mythings:fake-remote:${owner}`)!) as unknown[])
      .length;
    expect(b.calls.fetch.length).toBe(Math.floor(rows / fetchPage) + 1);
    expect(titles(b.app)).toHaveLength(60);
  });

  it("applies nothing and keeps the last edit seen when a page fails", async () => {
    const storage = memorySyncStorage();
    const a = device(1, storage);
    const b = device(2, storage);
    for (let i = 0; i < 60; i++) a.app.createToDo({ title: `To-do ${i}` });
    await a.syncer.sync();
    b.failFetchAfter(1);
    await b.syncer.sync();
    expect(b.syncer.status()).toMatchObject({ kind: "failed", reason: "page lost" });
    expect(titles(b.app)).toEqual([]);
    expect(b.app.lastReceivedAt()).toBeNull();
  });

  it("sends a device's earlier data on its first sync and merges it with the account's", async () => {
    const storage = memorySyncStorage();
    const a = device(1, storage);
    a.app.createToDo({ title: "From the phone" });
    await a.syncer.sync();
    const v1: SnapshotV1 = {
      version: 1,
      records: {
        areas: [
          {
            id: "home",
            owner: "me",
            createdAt: "2026-11-20T09:00:00.000Z",
            updatedAt: "2026-11-21T09:00:00.000Z",
            title: "Home",
            tagIds: [],
            position: 0,
          },
        ],
      },
      settings: { logbookMode: "endOfDay", accentColour: "teal" },
    };
    const b = device(2, storage, JSON.parse(JSON.stringify(v1)));
    await b.syncer.sync();
    expect(titles(b.app)).toEqual(["From the phone"]);
    await a.syncer.sync();
    expect(a.app.sidebar().areas.map((s) => s.area.title)).toEqual(["Home"]);
    expect(a.app.sidebar().areas[0].area.owner).toBe(owner);
  });

  it("runs one sync at a time, and once more for changes asked for meanwhile", async () => {
    const storage = memorySyncStorage();
    const a = device(1, storage);
    a.app.createToDo({ title: "Buy milk" });
    const first = a.syncer.sync();
    a.app.createToDo({ title: "Call Sam" });
    const second = a.syncer.sync();
    const third = a.syncer.sync();
    await Promise.all([first, second, third]);
    expect(a.calls.send).toHaveLength(2);
    expect(a.app.unsentEdits()).toEqual([]);
  });

  it("does nothing once stopped, even for a sync already under way", async () => {
    const storage = memorySyncStorage();
    const a = device(1, storage);
    const b = device(2, storage);
    a.app.createToDo({ title: "Buy milk" });
    await a.syncer.sync();
    const running = b.syncer.sync();
    b.syncer.stop();
    await running;
    await b.syncer.sync();
    expect(titles(b.app)).toEqual([]);
  });

  it("marks its own writes, so they don't count as changes to sync", async () => {
    const storage = memorySyncStorage();
    const a = device(1, storage);
    a.app.createToDo({ title: "Buy milk" });
    await a.syncer.sync();
    const seen: boolean[] = [];
    let writing = () => false;
    const store = memoryStore(undefined, () => seen.push(writing()));
    const app = createMyThings({ clock: fixedClock("2026-11-27T10:00:00"), store });
    app.changeOwner(owner);
    const syncer = createSyncer(
      app,
      fakeRemote(storage, owner, () => serverTime),
    );
    writing = syncer.isWriting;
    seen.length = 0;
    await syncer.sync();
    expect(titles(app)).toEqual(["Buy milk"]);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(Boolean)).toBe(true);
    // A change made here is not the syncer's.
    app.createToDo({ title: "Call Sam" });
    expect(seen.at(-1)).toBe(false);
  });
});

describe("sync status text", () => {
  const now = Date.parse("2026-11-27T10:00:00Z");
  it.each<[SyncStatus, string]>([
    [{ kind: "synced", at: now - 20_000 }, "Synced just now"],
    [{ kind: "synced", at: now - 60_000 }, "Synced 1 minute ago"],
    [{ kind: "synced", at: now - 5 * 60_000 }, "Synced 5 minutes ago"],
    [{ kind: "synced", at: now - 3 * 3600_000 }, "Synced 3 hours ago"],
    [{ kind: "syncing", lastSyncedAt: null }, "Syncing…"],
    [{ kind: "notYet" }, "Syncing…"],
    [{ kind: "offline", lastSyncedAt: null }, "Offline: changes will sync when you're back online"],
    [
      { kind: "failed", reason: "permission denied", lastSyncedAt: null },
      "Sync failed: permission denied",
    ],
  ])("%j", (status, text) => {
    expect(syncStatusText(status, now)).toBe(text);
  });
});
