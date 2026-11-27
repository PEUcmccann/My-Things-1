import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { useKeyboardInset } from "../useKeyboardInset";

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
}

/**
 * A panel that slides up over the screen. Tapping outside closes it. It stays above the
 * keyboard: KeyboardAvoidingView on iOS, the resized window on Android, and the visual
 * viewport on the web.
 */
export function Sheet({ visible, onClose, children, testID }: Props) {
  const theme = useTheme();
  const keyboard = useKeyboardInset();
  const safe = useSafeAreaInsets();
  // With the keyboard up, the home indicator is behind it, so only the keyboard needs room.
  const bottom = keyboard > 0 ? 20 : Math.max(32, safe.bottom + 20);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.fill, { paddingBottom: keyboard }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: bottom }]}
          testID={testID}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "85%",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
});
