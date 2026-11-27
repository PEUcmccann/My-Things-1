import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { builtInLists, useNavigation, type Route } from "../navigation";
import { listIcons, listTitles } from "../lists";
import { useTheme } from "../theme";

interface Props {
  /** On a wide screen the sidebar stays beside the content and replaces it on tap. */
  wide?: boolean;
}

export function Sidebar({ wide }: Props) {
  const theme = useTheme();
  const nav = useNavigation();
  const open = (route: Route) => (wide ? nav.reset(route) : nav.push(route));
  const isCurrent = (route: Route) => JSON.stringify(route) === JSON.stringify(nav.route);

  const item = (key: string, icon: string, title: string, route: Route) => (
    <Pressable
      key={key}
      onPress={() => open(route)}
      testID={`sidebar-${key}`}
      accessibilityRole="button"
      style={[styles.item, wide && isCurrent(route) && { backgroundColor: theme.border }]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.itemText, { color: theme.text }]}>{title}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      testID="sidebar"
    >
      <Text style={[styles.appName, { color: theme.accent }]}>MyThings</Text>
      <View style={styles.group}>
        {builtInLists
          .slice(0, 1)
          .map((list) => item(list, listIcons[list], listTitles[list], { name: "list", list }))}
      </View>
      <View style={styles.group}>
        {builtInLists
          .slice(1, 5)
          .map((list) => item(list, listIcons[list], listTitles[list], { name: "list", list }))}
      </View>
      <View style={styles.group}>
        {builtInLists
          .slice(5)
          .map((list) => item(list, listIcons[list], listTitles[list], { name: "list", list }))}
      </View>
      <View style={styles.group}>{item("settings", "⚙️", "Settings", { name: "settings" })}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  icon: { width: 30, fontSize: 18 },
  itemText: { fontSize: 17 },
});
