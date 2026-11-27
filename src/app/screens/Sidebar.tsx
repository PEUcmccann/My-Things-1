import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Project } from "../../core";
import { MenuSheet } from "../components/MenuSheet";
import { ProgressPie } from "../components/ProgressPie";
import { PromptSheet } from "../components/PromptSheet";
import { builtInLists, useNavigation, type BuiltInList, type Route } from "../navigation";
import { listIcons, listTitles } from "../lists";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

interface Props {
  /** On a wide screen the sidebar stays beside the content and replaces it on tap. */
  wide?: boolean;
}

type Dialog = "new" | "newArea" | "newProject" | null;

export function Sidebar({ wide }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const [dialog, setDialog] = useState<Dialog>(null);
  const open = (route: Route) => (wide ? nav.reset(route) : nav.push(route));
  const isCurrent = (route: Route) => JSON.stringify(route) === JSON.stringify(nav.route);
  const tree = app.sidebar();

  const item = (key: string, icon: React.ReactNode, title: string, route: Route, depth = 0) => (
    <Pressable
      key={key}
      onPress={() => open(route)}
      testID={`sidebar-${key}`}
      accessibilityRole="button"
      style={[
        styles.item,
        { paddingLeft: 8 + depth * 16 },
        wide && isCurrent(route) && { backgroundColor: theme.border },
      ]}
    >
      <View style={styles.icon}>
        {typeof icon === "string" ? <Text style={styles.iconText}>{icon}</Text> : icon}
      </View>
      <Text style={[styles.itemText, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
  const listItem = (list: BuiltInList) =>
    item(list, listIcons[list], listTitles[list], { name: "list", list });
  const projectItem = (p: Project, depth: number) => {
    const progress = app.projectProgress(p.id);
    return item(
      `project-${p.id}`,
      <ProgressPie share={progress.total ? progress.completed / progress.total : 0} />,
      p.title,
      { name: "project", id: p.id },
      depth,
    );
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} testID="sidebar">
        <Text style={[styles.appName, { color: theme.accent }]}>MyThings</Text>
        <View style={styles.group}>{builtInLists.slice(0, 1).map(listItem)}</View>
        <View style={styles.group}>{builtInLists.slice(1, 5).map(listItem)}</View>
        <View style={styles.group}>{builtInLists.slice(5).map(listItem)}</View>
        {tree.projects.length > 0 ? (
          <View style={styles.group}>{tree.projects.map((p) => projectItem(p, 0))}</View>
        ) : null}
        {tree.areas.map(({ area, projects }) => (
          <View style={styles.group} key={area.id}>
            {item(`area-${area.id}`, "▣", area.title, { name: "area", id: area.id })}
            {projects.map((p) => projectItem(p, 1))}
          </View>
        ))}
        <View style={styles.group}>
          {item("tags", "🏷", "Tags", { name: "tags" })}
          {item("settings", "⚙️", "Settings", { name: "settings" })}
        </View>
      </ScrollView>
      <Pressable
        onPress={() => setDialog("new")}
        style={[styles.newList, { borderColor: theme.border }]}
        testID="sidebar-new"
        accessibilityRole="button"
      >
        <Text style={[styles.newListText, { color: theme.accent }]}>＋ New List</Text>
      </Pressable>
      <MenuSheet
        visible={dialog === "new"}
        onClose={() => setDialog(null)}
        options={[
          {
            title: "◔ New Project",
            onPress: () => setDialog("newProject"),
            testID: "new-project",
          },
          { title: "▣ New Area", onPress: () => setDialog("newArea"), testID: "new-area" },
        ]}
      />
      {dialog === "newProject" ? (
        <PromptSheet
          title="New Project"
          placeholder="Project name"
          confirmTitle="Create"
          onSubmit={(title) => open({ name: "project", id: app.createProject({ title }) })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "newArea" ? (
        <PromptSheet
          title="New Area"
          placeholder="Area name, e.g. Work or Home"
          confirmTitle="Create"
          onSubmit={(title) => open({ name: "area", id: app.createArea(title) })}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  appName: { fontSize: 22, fontWeight: "800", marginBottom: 16, marginLeft: 8 },
  group: { marginBottom: 16 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  icon: { width: 30, alignItems: "flex-start" },
  iconText: { fontSize: 18 },
  itemText: { fontSize: 17, flex: 1 },
  newList: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16 },
  newListText: { fontSize: 16, fontWeight: "600" },
});
