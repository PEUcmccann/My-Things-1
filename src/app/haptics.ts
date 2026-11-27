import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/** Haptic feedback on iPhone and Android. Skipped quietly on the web. */
function run(feedback: () => Promise<void>): void {
  if (Platform.OS === "web") return;
  feedback().catch(() => undefined);
}

export const haptics = {
  /** Picking something up, such as starting a drag. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Something worked: completing, creating, dropping. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
