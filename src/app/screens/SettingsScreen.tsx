import { Pressable, StyleSheet, Text, View } from "react-native";
import { accentColours, type LogbookMode } from "../../core";
import { Button } from "../components/Button";
import { Choice } from "../components/Choice";
import { Screen } from "../components/Screen";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { accents, useTheme } from "../theme";

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
  const nav = useNavigation();
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
      <Text style={[styles.section, { color: theme.muted }]}>Accent colour</Text>
      <View style={styles.swatches} testID="accent-colours">
        {accentColours.map((colour) => {
          const chosen = app.accentColour() === colour;
          return (
            <Pressable
              key={colour}
              onPress={() => app.setAccentColour(colour)}
              accessibilityRole="radio"
              aria-checked={chosen}
              accessibilityLabel={accents[colour].name}
              testID={`accent-${colour}`}
              style={[
                styles.swatch,
                { backgroundColor: theme.dark ? accents[colour].dark : accents[colour].light },
                chosen && { borderColor: theme.text },
              ]}
            >
              {chosen ? <Text style={{ color: theme.onAccent, fontWeight: "800" }}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.section, { color: theme.muted }]}>Tags</Text>
      <Button
        title="Manage Tags"
        onPress={() => nav.push({ name: "tags" })}
        testID="settings-tags"
      />
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
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginLeft: 8 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "transparent",
  },
});
