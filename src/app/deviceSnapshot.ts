// Where the saved snapshot lives in Expo Go: AsyncStorage, which keeps large values in
// files on iPhone. The web build uses deviceSnapshot.web.ts.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const snapshotKey = "mythings:store";

export function readSnapshot(): Promise<string | null> {
  return AsyncStorage.getItem(snapshotKey);
}

export function writeSnapshot(text: string): Promise<void> {
  return AsyncStorage.setItem(snapshotKey, text);
}
