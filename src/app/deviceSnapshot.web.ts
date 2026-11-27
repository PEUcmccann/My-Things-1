// Where the saved snapshot lives on the web: IndexedDB, not localStorage. With sync's
// edit times the snapshot of a few thousand To-dos passes localStorage's limit of about
// 5 MB per site (measured in M3-04: about 17 MB for 2,000 To-dos with notes and
// Checklists), while IndexedDB allows far more. Expo Go uses deviceSnapshot.ts.

export const snapshotKey = "mythings:store";

const databaseName = "mythings";
const storeName = "snapshot";

let opened: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opened;
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(storeName, mode).objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** The saved snapshot, moved here from localStorage, where earlier versions kept it. */
export async function readSnapshot(): Promise<string | null> {
  const saved = await run<string | undefined>("readonly", (s) => s.get(snapshotKey));
  if (saved !== undefined) return saved;
  const old = globalThis.localStorage?.getItem(snapshotKey) ?? null;
  if (old !== null) {
    await writeSnapshot(old);
    globalThis.localStorage.removeItem(snapshotKey);
  }
  return old;
}

export async function writeSnapshot(text: string): Promise<void> {
  await run("readwrite", (s) => s.put(text, snapshotKey));
}
