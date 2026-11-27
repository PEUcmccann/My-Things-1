import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DragProvider } from "./drag";
import { FinishProvider } from "./finish";
import { NavigationProvider, useNavigation, type Route } from "./navigation";
import { AreaScreen } from "./screens/AreaScreen";
import { ListScreen } from "./screens/ListScreen";
import { ProjectScreen } from "./screens/ProjectScreen";
import { LogbookScreen } from "./screens/LogbookScreen";
import { QuickFindScreen } from "./screens/QuickFindScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TagScreen } from "./screens/TagScreen";
import { TagsScreen } from "./screens/TagsScreen";
import { ToDoScreen } from "./screens/ToDoScreen";
import { TrashScreen } from "./screens/TrashScreen";
import { UpcomingScreen } from "./screens/UpcomingScreen";
import { Sidebar } from "./screens/Sidebar";
import { SelectionProvider } from "./selection";
import { MyThingsProvider } from "./state";
import { useTheme } from "./theme";

/** Screens wider than this show the sidebar beside the content. */
const WIDE = 768;

/** Each new screen fades and slides in. */
function Transition({ children }: { children: React.ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [progress]);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  return (
    <Animated.View style={[styles.fill, { opacity: progress, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

function CurrentScreen() {
  const { route } = useNavigation();
  return (
    <Transition key={JSON.stringify(route)}>
      <ScreenFor route={route} />
    </Transition>
  );
}

function ScreenFor({ route }: { route: Route }) {
  switch (route.name) {
    case "sidebar":
      return <Sidebar />;
    case "list":
      if (route.list === "logbook") return <LogbookScreen />;
      if (route.list === "trash") return <TrashScreen />;
      if (route.list === "upcoming") return <UpcomingScreen />;
      return <ListScreen key={route.list} list={route.list} />;
    case "settings":
      return <SettingsScreen />;
    case "area":
      return <AreaScreen key={route.id} id={route.id} />;
    case "project":
      return <ProjectScreen key={route.id} id={route.id} />;
    case "quickFind":
      return <QuickFindScreen />;
    case "tags":
      return <TagsScreen />;
    case "tag":
      return <TagScreen key={route.id} id={route.id} />;
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
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <NavigationProvider key={wide ? "wide" : "narrow"} root={root}>
        <SelectionProvider>
          <DragProvider>
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
          </DragProvider>
        </SelectionProvider>
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
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <MyThingsProvider loading={<Loading />}>
          <FinishProvider>
            <Layout />
          </FinishProvider>
        </MyThingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Keeps the web page itself from scrolling when a screen slides in.
  root: { flex: 1, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  row: { flex: 1, flexDirection: "row" },
  side: { width: 280, borderRightWidth: StyleSheet.hairlineWidth },
});
