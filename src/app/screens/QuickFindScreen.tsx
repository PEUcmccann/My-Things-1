import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Empty } from "../components/Empty";
import { ProjectRow } from "../components/ProjectRow";
import { Screen } from "../components/Screen";
import { ToDoRow } from "../components/ToDoRow";
import { useNavigation, type Route } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

/** Searches everything: To-dos, notes, Checklist items, containers and Tags. */
export function QuickFindScreen() {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const [query, setQuery] = useState("");
  const [includeLogbook, setIncludeLogbook] = useState(false);
  const results = app.quickFind(query, { includeLogbook });
  const count =
    results.areas.length +
    results.projects.length +
    results.headings.length +
    results.tags.length +
    results.toDos.length;

  const section = (title: string, children: React.ReactNode, n: number) =>
    n === 0 ? null : (
      <View key={title} testID={`results-${title.toLowerCase()}`}>
        <Text style={[styles.section, { color: theme.muted }]}>{title}</Text>
        {children}
      </View>
    );
  const simpleRow = (key: string, text: string, route: Route, detail?: string) => (
    <Pressable
      key={key}
      onPress={() => nav.push(route)}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={`result-${key}`}
    >
      <Text style={{ color: theme.text, fontSize: 16 }}>{text}</Text>
      {detail ? <Text style={{ color: theme.muted, fontSize: 12 }}>{detail}</Text> : null}
    </Pressable>
  );

  return (
    <Screen
      title="Quick Find"
      testID="screen-quickfind"
      header={
        <View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Search everything"
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            testID="quickfind-input"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          <View style={styles.toggle}>
            <Text style={{ color: theme.text, flex: 1 }}>Include Logbook</Text>
            <Switch
              value={includeLogbook}
              onValueChange={setIncludeLogbook}
              testID="quickfind-logbook"
              trackColor={{ true: theme.accent, false: theme.border }}
            />
          </View>
        </View>
      }
    >
      {query.trim() && count === 0 ? <Empty text="No results" /> : null}
      {section(
        "Areas",
        results.areas.map((a) =>
          simpleRow(`area-${a.id}`, `▣ ${a.title}`, { name: "area", id: a.id }),
        ),
        results.areas.length,
      )}
      {section(
        "Projects",
        results.projects.map((p) => <ProjectRow key={p.id} project={p} />),
        results.projects.length,
      )}
      {section(
        "Headings",
        results.headings.map(({ heading, projectTitle }) =>
          simpleRow(
            `heading-${heading.id}`,
            heading.title,
            { name: "project", id: heading.projectId },
            `in ${projectTitle}`,
          ),
        ),
        results.headings.length,
      )}
      {section(
        "Tags",
        results.tags.map((t) =>
          simpleRow(`tag-${t.id}`, `🏷 ${t.title}`, { name: "tag", id: t.id }),
        ),
        results.tags.length,
      )}
      {section(
        "To-dos",
        results.toDos.map((m) => (
          <View key={m.toDo.id}>
            <ToDoRow entry={m} onPress={() => nav.push({ name: "toDo", id: m.toDo.id })} />
            {m.excerpt ? (
              <Text style={[styles.excerpt, { color: theme.muted }]} testID="result-excerpt">
                {m.field === "notes" ? "Notes: " : "Checklist: "}
                {m.excerpt}
              </Text>
            ) : null}
          </View>
        )),
        results.toDos.length,
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 17, marginTop: 8 },
  toggle: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  section: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 8,
  },
  row: {
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  excerpt: { fontSize: 12, marginLeft: 46, marginTop: -2, marginBottom: 8 },
});
