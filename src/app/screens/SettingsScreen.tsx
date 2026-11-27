import { StyleSheet, Text, View } from "react-native";
import type { LogbookMode } from "../../core";
import { Button } from "../components/Button";
import { Choice } from "../components/Choice";
import { Screen } from "../components/Screen";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

const logbookOptions: { value: LogbookMode; title: string; detail: string }[] = [
  { value: "immediately", title: "Immediately", detail: "As soon as you finish an item" },
  {
    value: "endOfDay",
    title: "At the end of the day",
    detail: "Finished items stay until tomorrow",
  },
  { value: "manually", title: "Manually", detail: "When you choose to move them" },
];

export function SettingsScreen() {
  const app = useMyThings();
  const theme = useTheme();
  const mode = app.logbookMode();
  return (
    <Screen title="Settings" testID="screen-settings">
      <Text style={[styles.section, { color: theme.muted }]}>Move to the Logbook</Text>
      <Choice
        options={logbookOptions}
        value={mode}
        onChange={(m) => app.setLogbookMode(m)}
        testID="logbook-mode"
      />
      {mode === "manually" ? (
        <View style={styles.after}>
          <Button
            title="Move finished items to the Logbook"
            onPress={() => app.moveFinishedToLogbook()}
            disabled={!app.hasFinishedOutsideLogbook()}
            testID="settings-log-finished"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 8,
  },
  after: { marginTop: 12 },
});
