import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RestoreError } from "../../core";
import { backupDateText, backupErrorText, backupRowText, type Backup } from "../backups";
import { Button } from "../components/Button";
import { MenuSheet } from "../components/MenuSheet";
import { restoreProblemText } from "../dataFiles";
import { useBackups } from "../state";
import { useTheme } from "../theme";

/**
 * Settings → Data → Backups: the account's weekly Backups, newest first, with Back up
 * now and Restore on each (M3-08). Signed out, there are none.
 */
export function BackupsSection() {
  const theme = useTheme();
  const backups = useBackups();
  const [asking, setAsking] = useState<Backup | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<{ text: string; error: boolean } | null>(null);

  if (!backups) {
    return (
      <View style={styles.section} testID="backups-section">
        <Text style={[styles.heading, { color: theme.text }]}>Backups</Text>
        <Text style={[styles.line, { color: theme.muted }]}>Sign in to back up automatically</Text>
      </View>
    );
  }

  const { list, busy, error } = backups;

  async function restore(backup: Backup) {
    setRestoreStatus(null);
    try {
      await backups!.restore(backup);
      setRestoreStatus({ text: "Restored", error: false });
    } catch (e) {
      console.warn("Could not restore the backup", e);
      setRestoreStatus({
        text: e instanceof RestoreError ? restoreProblemText(e.problem) : backupErrorText(e),
        error: true,
      });
    }
  }

  const newest = list?.[0];
  return (
    <View style={styles.section} testID="backups-section">
      <Text style={[styles.heading, { color: theme.text }]}>Backups</Text>
      <Text style={[styles.line, { color: theme.muted }]} testID="backups-last">
        {list === null
          ? busy
            ? "Checking backups…"
            : "Backups will be checked after the next sync"
          : newest
            ? `Last backup: ${backupDateText(newest)}`
            : "No backups yet"}
      </Text>
      {list?.map((backup) => (
        <View
          key={backup.path}
          style={[styles.row, { borderColor: theme.border }]}
          testID="backup-row"
        >
          <Text style={[styles.rowText, { color: theme.text }]}>{backupRowText(backup)}</Text>
          <Button title="Restore" small onPress={() => setAsking(backup)} testID="backup-restore" />
        </View>
      ))}
      <View style={styles.after}>
        <Button
          title={busy ? "Backing up…" : "Back up now"}
          onPress={() => {
            setRestoreStatus(null);
            void backups.backUpNow();
          }}
          disabled={busy}
          testID="backup-now"
        />
      </View>
      {error || restoreStatus ? (
        <Text
          style={[
            styles.line,
            { color: error || restoreStatus?.error ? theme.danger : theme.muted },
          ]}
          testID="backups-status"
        >
          {error ?? restoreStatus?.text}
        </Text>
      ) : null}
      <MenuSheet
        visible={asking !== null}
        title="Restore this backup?"
        message={
          asking
            ? `Replace everything with the backup from ${backupDateText(asking)}? This can't be undone.`
            : undefined
        }
        onClose={() => setAsking(null)}
        testID="backup-restore-sheet"
        options={[
          {
            title: "Replace",
            danger: true,
            onPress: () => asking && void restore(asking),
            testID: "backup-restore-confirm",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16, gap: 6 },
  heading: { fontSize: 15, fontWeight: "600", marginLeft: 8 },
  line: { fontSize: 13, marginLeft: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, fontSize: 15 },
  after: { marginTop: 6 },
});
