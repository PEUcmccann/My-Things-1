import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useDrag } from "../drag";
import { useSelection } from "../selection";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { useNavigation } from "../navigation";
import { useTheme } from "../theme";

interface Props {
  title: string;
  /** Shown before the title, in the list's colour. */
  icon?: IconName;
  /** Defaults to the list's colour for a list icon, otherwise the text colour. */
  iconColor?: string;
  children: ReactNode;
  /** Buttons shown at the right of the header. */
  actions?: ReactNode;
  /** Shown under the title, above the scrolling content. */
  header?: ReactNode;
  /** Offers a Select button that starts selecting To-dos. */
  selectable?: boolean;
  /** Offers Quick Find: a search button, and pulling the list down. */
  searchable?: boolean;
  testID?: string;
}

/** How far a list must be pulled down past its top to open Quick Find. */
const pullToFind = 70;

export function Screen(props: Props) {
  const { title, icon, iconColor, children, actions, header, testID, selectable, searchable } =
    props;
  const theme = useTheme();
  const nav = useNavigation();
  const drag = useDrag();
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]} testID={testID}>
      <View style={styles.header}>
        {nav.canGoBack ? (
          <Pressable
            onPress={nav.back}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="back"
            hitSlop={12}
            style={styles.back}
          >
            <Text style={[styles.backText, { color: theme.accent }]}>‹ Back</Text>
          </Pressable>
        ) : null}
        <View style={styles.titleRow}>
          {icon ? (
            <View style={styles.icon}>
              <Icon name={icon} size={26} color={iconColor} />
            </View>
          ) : null}
          <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
            {title}
          </Text>
          <View style={styles.actions}>
            {searchable ? (
              <Button
                small
                icon="quickFind"
                accessibilityLabel="Quick Find"
                onPress={() => nav.push({ name: "quickFind" })}
                testID="open-quickfind"
              />
            ) : null}
            {selectable ? <SelectButton /> : null}
            {actions}
          </View>
        </View>
        {header}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!drag.dragging}
        alwaysBounceVertical={searchable}
        onScrollEndDrag={(e) => {
          if (searchable && e.nativeEvent.contentOffset.y < -pullToFind) {
            nav.push({ name: "quickFind" });
          }
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function SelectButton() {
  const selection = useSelection();
  return (
    <Button
      small
      title={selection.active ? "Done" : "Select"}
      onPress={() => (selection.active ? selection.clear() : selection.start())}
      testID="select-mode"
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  back: { alignSelf: "flex-start", paddingVertical: 4 },
  backText: { fontSize: 17 },
  titleRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  icon: { marginRight: 8 },
  title: { fontSize: 28, fontWeight: "700", flex: 1 },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  content: { paddingHorizontal: 12, paddingBottom: 120 },
});
