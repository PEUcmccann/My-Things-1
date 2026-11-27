import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { DropTarget, Project } from "../../core";
import {
  toDoTargetDrop,
  DragHandle,
  useDrag,
  useDropList,
  useDropRow,
  useDropTarget,
  type DragItem,
} from "../drag";
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

const areasListKey = "sidebar-areas";

/** A sidebar row: opens its list, takes dropped To-dos, and can be dragged to reorder. */
function SidebarItem(props: {
  testKey: string;
  icon: React.ReactNode;
  title: string;
  depth: number;
  current: boolean;
  onPress: () => void;
  target?: DropTarget;
  drag?: DragItem;
  listKey?: string;
}) {
  const app = useMyThings();
  const theme = useTheme();
  const drag = useDrag();
  const { target, drag: item } = props;
  const dropKey = `sidebar-${props.testKey}`;
  const ref = useDropTarget(dropKey, {
    accepts: (dragged) => {
      if (!target) return false;
      // A Project dropped on an Area moves into it.
      if (dragged.kind === "project") return target.kind === "area";
      return toDoTargetDrop(app, drag, target).accepts(dragged);
    },
    onDrop: (dragged) => {
      if (!target) return;
      if (dragged.kind === "project" && target.kind === "area") {
        app.placeProject(dragged.id, target.id, null);
      } else toDoTargetDrop(app, drag, target).onDrop(dragged);
    },
  });
  const rowRef = useDropRow(props.listKey, item && "id" in item ? item.id : props.testKey);
  const hovered = drag.hovered === dropKey;
  return (
    <View ref={rowRef} collapsable={false}>
      <View ref={ref} collapsable={false}>
        <Pressable
          onPress={props.onPress}
          testID={`sidebar-${props.testKey}`}
          accessibilityRole="button"
          style={[
            styles.item,
            { paddingLeft: 8 + props.depth * 16 },
            (props.current || hovered) && { backgroundColor: theme.border },
          ]}
        >
          <View style={styles.icon}>
            {typeof props.icon === "string" ? (
              <Text style={[styles.iconText, { color: theme.text }]}>{props.icon}</Text>
            ) : (
              props.icon
            )}
          </View>
          <Text style={[styles.itemText, { color: theme.text }]} numberOfLines={1}>
            {props.title}
          </Text>
          {item ? <SidebarHandle item={item} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

function SidebarHandle({ item }: { item: DragItem }) {
  const theme = useTheme();
  return (
    <DragHandle
      item={item}
      style={styles.handle}
      testID={`sidebar-drag-${"id" in item ? item.id : ""}`}
    >
      <Text style={{ color: theme.muted, fontSize: 18 }}>≡</Text>
    </DragHandle>
  );
}

/** The Projects of one Area (or with no Area), which Projects can be dropped between. */
function ProjectDropList({
  areaId,
  children,
}: {
  areaId: string | null;
  children: (listKey: string) => React.ReactNode;
}) {
  const app = useMyThings();
  const drag = useDrag();
  const listKey = `sidebar-projects-${areaId ?? "none"}`;
  const ref = useDropList(listKey, {
    accepts: (item) => item.kind === "project",
    onDrop: (item, beforeId) => {
      if (item.kind === "project") app.placeProject(item.id, areaId, beforeId);
    },
  });
  const empty = drag.dragging?.kind === "project" && areaId === null;
  return (
    <View ref={ref} collapsable={false} style={empty ? styles.dropSpace : undefined}>
      {children(listKey)}
    </View>
  );
}

function AreaDropList({ children }: { children: React.ReactNode }) {
  const app = useMyThings();
  const ref = useDropList(areasListKey, {
    accepts: (item) => item.kind === "area",
    onDrop: (item, beforeId) => {
      if (item.kind === "area") app.placeArea(item.id, beforeId);
    },
  });
  return (
    <View ref={ref} collapsable={false}>
      {children}
    </View>
  );
}

function AreaGroup({ id, children }: { id: string; children: React.ReactNode }) {
  const ref = useDropRow(areasListKey, id);
  return (
    <View ref={ref} collapsable={false} style={styles.group}>
      {children}
    </View>
  );
}

export function Sidebar({ wide }: Props) {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const [dialog, setDialog] = useState<Dialog>(null);
  const drag = useDrag();
  const open = (route: Route) => (wide ? nav.reset(route) : nav.push(route));
  const isCurrent = (route: Route) => JSON.stringify(route) === JSON.stringify(nav.route);
  const tree = app.sidebar();

  const item = (
    key: string,
    icon: React.ReactNode,
    title: string,
    route: Route,
    opts: { depth?: number; target?: DropTarget; drag?: DragItem; listKey?: string } = {},
  ) => (
    <SidebarItem
      key={key}
      testKey={key}
      icon={icon}
      title={title}
      depth={opts.depth ?? 0}
      current={!!wide && isCurrent(route)}
      onPress={() => open(route)}
      target={opts.target}
      drag={opts.drag}
      listKey={opts.listKey}
    />
  );
  const listItem = (list: BuiltInList) => {
    const target: DropTarget | undefined =
      list === "inbox" || list === "today" || list === "someday" ? { kind: list } : undefined;
    return item(list, listIcons[list], listTitles[list], { name: "list", list }, { target });
  };
  const projectItem = (p: Project, depth: number, listKey: string) => {
    const progress = app.projectProgress(p.id);
    return item(
      `project-${p.id}`,
      <ProgressPie share={progress.total ? progress.completed / progress.total : 0} />,
      p.title,
      { name: "project", id: p.id },
      {
        depth,
        target: { kind: "project", id: p.id },
        drag: { kind: "project", id: p.id, title: p.title },
        listKey,
      },
    );
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        testID="sidebar"
        scrollEnabled={!drag.dragging}
      >
        <Text style={[styles.appName, { color: theme.accent }]}>MyThings</Text>
        <View style={styles.group}>{builtInLists.slice(0, 1).map(listItem)}</View>
        <View style={styles.group}>{builtInLists.slice(1, 5).map(listItem)}</View>
        <View style={styles.group}>{builtInLists.slice(5).map(listItem)}</View>
        <ProjectDropList areaId={null}>
          {(listKey) =>
            tree.projects.length > 0 ? (
              <View style={styles.group}>
                {tree.projects.map((p) => projectItem(p, 0, listKey))}
              </View>
            ) : null
          }
        </ProjectDropList>
        <AreaDropList>
          {tree.areas.map(({ area, projects }) => (
            <AreaGroup key={area.id} id={area.id}>
              {item(
                `area-${area.id}`,
                "▣",
                area.title,
                { name: "area", id: area.id },
                {
                  target: { kind: "area", id: area.id },
                  drag: { kind: "area", id: area.id, title: area.title },
                },
              )}
              <ProjectDropList areaId={area.id}>
                {(listKey) => projects.map((p) => projectItem(p, 1, listKey))}
              </ProjectDropList>
            </AreaGroup>
          ))}
        </AreaDropList>
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
  handle: { paddingHorizontal: 6 },
  dropSpace: { minHeight: 40 },
  newList: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16 },
  newListText: { fontSize: 16, fontWeight: "600" },
});
