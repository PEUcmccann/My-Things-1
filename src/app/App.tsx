import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationProvider, useNavigation, type Route } from "./navigation";
import { AreaScreen } from "./screens/AreaScreen";
import { ListScreen } from "./screens/ListScreen";
import { ProjectScreen } from "./screens/ProjectScreen";
import { LogbookScreen } from "./screens/LogbookScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { ToDoScreen } from "./screens/ToDoScreen";
import { Sidebar } from "./screens/Sidebar";
import { MyThingsProvider } from "./state";
import { useTheme } from "./theme";

/** Screens wider than this show the sidebar beside the content. */
const WIDE = 768;

function CurrentScreen() {
  const { route } = useNavigation();
  switch (route.name) {
    case "sidebar":
      return <Sidebar />;
    case "list":
      if (route.list === "logbook") return <LogbookScreen />;
      return <ListScreen key={route.list} list={route.list} />;
    case "settings":
      return <SettingsScreen />;
    case "area":
      return <AreaScreen key={route.id} id={route.id} />;
    case "project":
      return <ProjectScreen key={route.id} id={route.id} />;
    case "toDo":
      return <ToDoScreen key={route.id} id={route.id} />;
  }
}

function Layout() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const root: Route = wide ? { name: "list", list: "inbox" } : { name: "sidebar" };
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.background }]}>
      <NavigationProvider key={wide ? "wide" : "narrow"} root={root}>
        {wide ? (
          <View style={styles.row}>
            <View style={[styles.side, { borderColor: theme.border }]}>
              <Sidebar wide />
            </View>
            <View style={styles.fill}>
              <CurrentScreen />
            </View>
          </View>
        ) : (
          <CurrentScreen />
        )}
      </NavigationProvider>
      <StatusBar style={theme.dark ? "light" : "dark"} />
    </SafeAreaView>
  );
}

function Loading() {
  const theme = useTheme();
  return (
    <View style={[styles.fill, styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MyThingsProvider loading={<Loading />}>
        <Layout />
      </MyThingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  row: { flex: 1, flexDirection: "row" },
  side: { width: 280, borderRightWidth: StyleSheet.hairlineWidth },
});
