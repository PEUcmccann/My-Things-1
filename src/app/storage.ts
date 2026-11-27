import AsyncStorage from "@react-native-async-storage/async-storage";
import { memoryStore, type MemoryStore, type Snapshot } from "../core";

const KEY = "mythings:store";

/**
 * Loads the core's store from the device (AsyncStorage: the file system in Expo Go,
 * localStorage on the web) and saves it again after every change.
 */
export async function loadDeviceStore(onChange: () => void): Promise<MemoryStore> {
  let snapshot: Snapshot | undefined;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) snapshot = JSON.parse(raw) as Snapshot;
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
      AsyncStorage.setItem(KEY, JSON.stringify(store.snapshot())).catch((error) =>
        console.warn("Could not save data", error),
      );
    });
  });
  return store;
}
