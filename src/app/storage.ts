import { memoryStore, type MemoryStore, type Snapshot, type SnapshotV1 } from "../core";
import { readSnapshot, writeSnapshot } from "./deviceSnapshot";

/**
 * Loads the core's store from the device (AsyncStorage in Expo Go, IndexedDB on the
 * web: deviceSnapshot.ts) and saves it again after every change.
 */
export async function loadDeviceStore(onChange: () => void): Promise<MemoryStore> {
  // Version 1 was saved before sync (Milestones 1 and 2); the core migrates it.
  let snapshot: Snapshot | SnapshotV1 | undefined;
  try {
    const raw = await readSnapshot();
    if (raw) snapshot = JSON.parse(raw) as Snapshot | SnapshotV1;
  } catch (error) {
    console.warn("Could not load saved data", error);
  }

  let saveQueued = false;
  const store: MemoryStore = memoryStore(snapshot, () => {
    onChange();
    if (saveQueued) return;
    saveQueued = true;
    // Several writes from one action are saved together.
    queueMicrotask(() => {
      saveQueued = false;
      writeSnapshot(JSON.stringify(store.snapshot())).catch((error) =>
        console.warn("Could not save data", error),
      );
    });
  });
  return store;
}
