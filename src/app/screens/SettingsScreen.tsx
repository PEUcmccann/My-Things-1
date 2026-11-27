import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { accentColours, readExport, RestoreError, type LogbookMode } from "../../core";
import { Button } from "../components/Button";
import { Choice } from "../components/Choice";
import { MenuSheet } from "../components/MenuSheet";
import { Screen } from "../components/Screen";
import { exportDateText, exportFileName, restoreProblemText } from "../dataFiles";
import { pickTextFile, saveFile } from "../fileSaving";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { accents, useTheme } from "../theme";

const logbookOptions: { value: LogbookMode; title: string; detail: string }[] = [
  {
    value: "immediately",
    title: "Immediately",
    detail: "As soon as a To-do or Project is Completed or Cancelled",
  },
  {
    value: "endOfDay",
    title: "At the end of the day",
    detail: "Completed and Cancelled To-dos stay in their list until tomorrow",
  },
  { value: "manually", title: "Manually", detail: "When you choose to move them" },
];

export function SettingsScreen() {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const mode = app.logbookMode();
  return (
    <Screen title="Settings" icon="settings" testID="screen-settings">
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
            title="Move Completed and Cancelled to the Logbook"
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
      <DataSection />
    </Screen>
  );
}

const jsonType = "application/json";

/** Export all data as one JSON file, and restore such a file. */
function DataSection() {
  const app = useMyThings();
  const theme = useTheme();
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  // A picked file waiting for the user to confirm the restore.
  const [pending, setPending] = useState<{ text: string; date: string } | null>(null);

  async function exportAll() {
    setStatus(null);
    try {
      const file = app.exportAll();
      await saveFile(exportFileName(app.currentDate()), JSON.stringify(file, null, 2), jsonType);
    } catch (error) {
      console.warn("Could not export", error);
      setStatus({ text: "Could not export", error: true });
    }
  }

  async function pick() {
    setStatus(null);
    try {
      const text = await pickTextFile(jsonType);
      if (text === null) return;
      setPending({ text, date: exportDateText(readExport(text).exportedAt) });
    } catch (error) {
      if (error instanceof RestoreError) {
        setStatus({ text: restoreProblemText(error.problem), error: true });
      } else {
        console.warn("Could not read the file", error);
        setStatus({ text: "Could not read the file", error: true });
      }
    }
  }

  function replace(text: string) {
    try {
      app.restoreExport(text);
      // As when the app opens: Trash older than 30 days in the file goes for good.
      app.purgeExpiredTrash();
      setStatus({ text: "Restored", error: false });
    } catch (error) {
      setStatus({
        text:
          error instanceof RestoreError ? restoreProblemText(error.problem) : "Could not restore",
        error: true,
      });
    }
  }

  return (
    <>
      <Text style={[styles.section, { color: theme.muted }]}>Data</Text>
      <View style={styles.buttons}>
        <Button title="Export all data" onPress={exportAll} testID="export-data" />
        <Button title="Restore from file" onPress={pick} testID="restore-data" />
      </View>
      {status ? (
        <Text
          style={[styles.status, { color: status.error ? theme.danger : theme.muted }]}
          testID="data-status"
        >
          {status.text}
        </Text>
      ) : null}
      <MenuSheet
        visible={pending !== null}
        title="Restore from file?"
        message={
          pending
            ? `Replace everything on this device with the data from ${pending.date}? This can't be undone.`
            : undefined
        }
        onClose={() => setPending(null)}
        testID="restore-confirm-sheet"
        options={[
          {
            title: "Replace",
            danger: true,
            onPress: () => pending && replace(pending.text),
            testID: "restore-data-confirm",
          },
        ]}
      />
    </>
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
  buttons: { gap: 8 },
  status: { fontSize: 13, marginTop: 8, marginLeft: 8 },
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
