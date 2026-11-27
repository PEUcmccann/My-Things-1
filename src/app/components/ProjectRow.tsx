import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Project } from "../../core";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";
import { DateBadges } from "./DateBadges";
import { ProgressPie } from "./ProgressPie";
import { TagChips } from "./TagChips";

/** A Project shown in a list, with its progress and dates. Tapping opens it. */
export function ProjectRow({ project }: { project: Project }) {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const progress = app.projectProgress(project.id);
  const finished = project.outcome !== "active";
  return (
    <Pressable
      onPress={() => nav.push({ name: "project", id: project.id })}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={`project-row-${project.id}`}
    >
      <ProgressPie share={progress.total ? progress.completed / progress.total : 0} />
      <View style={styles.body}>
        <Text
          style={[
            styles.title,
            { color: finished ? theme.muted : theme.text },
            finished && styles.struck,
          ]}
        >
          {project.title}
        </Text>
        <TagChips tags={app.tagsOf({ kind: "project", id: project.id })} />
        <DateBadges item={project} />
      </View>
      {finished ? (
        <Text style={[styles.badge, { color: theme.muted }]}>
          {project.outcome === "completed" ? "Completed" : "Cancelled"}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: "600" },
  struck: { textDecorationLine: "line-through" },
  badge: { fontSize: 12 },
});
