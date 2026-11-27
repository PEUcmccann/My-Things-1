import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import type { DropTarget, ListRef, MyThings, NewToDo } from "../core";
import { haptics } from "./haptics";
import { useMyThings } from "./state";
import { useTheme } from "./theme";

/** What is being dragged. */
export type DragItem =
  | { kind: "toDo"; id: string; title: string; isSubToDo: boolean }
  | { kind: "new" }
  | { kind: "area"; id: string; title: string }
  | { kind: "project"; id: string; title: string };

/** Where Magic Plus was dropped: the new To-do's placement and, for a list, its spot. */
export interface NewToDoSpot {
  placement: Omit<NewToDo, "title">;
  at?: { list: ListRef; beforeId: string | null };
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ViewNode = ComponentRef<typeof View>;
type Measurable = RefObject<ViewNode | null>;

interface Target {
  ref: Measurable;
  accepts: (item: DragItem) => boolean;
  onDrop: (item: DragItem) => void;
}

interface DropList {
  ref: Measurable;
  accepts: (item: DragItem) => boolean;
  onDrop: (item: DragItem, beforeId: string | null) => void;
}

interface DragApi {
  dragging: DragItem | null;
  hovered: string | null;
  registerTarget(key: string, target: Target): () => void;
  registerList(key: string, list: DropList): () => void;
  registerRow(listKey: string, id: string, ref: Measurable): () => void;
  /** Set by Magic Plus: opens the new To-do sheet for a drop. */
  setNewToDoOpener(open: ((spot: NewToDoSpot) => void) | null): void;
  openNewToDo(spot: NewToDoSpot): void;
}

const Context = createContext<DragApi | null>(null);

function measure(ref: Measurable): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

const inside = (r: Rect | null | undefined, x: number, y: number) =>
  !!r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

/** Drag and drop for To-dos, Magic Plus, Projects and Areas. Works with touch and mouse. */
export function DragProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const targets = useRef(new Map<string, Target>());
  const lists = useRef(new Map<string, DropList>());
  const rows = useRef(new Map<string, Map<string, Measurable>>());
  const rects = useRef(new Map<string, Rect | null>());
  const [pointer] = useState(() => new Animated.ValueXY());
  const last = useRef({ x: 0, y: 0 });
  const newOpener = useRef<((spot: NewToDoSpot) => void) | null>(null);
  const [dragging, setDragging] = useState<DragItem | null>(null);
  const draggingRef = useRef<DragItem | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const measureTargets = useCallback(async () => {
    const entries = [...targets.current.entries()];
    const measured = await Promise.all(entries.map(([, t]) => measure(t.ref)));
    entries.forEach(([key], i) => rects.current.set(`target:${key}`, measured[i]));
  }, []);

  const hitTarget = useCallback((item: DragItem, x: number, y: number) => {
    for (const [key, t] of targets.current) {
      if (t.accepts(item) && inside(rects.current.get(`target:${key}`), x, y)) return key;
    }
    return null;
  }, []);

  const start = useCallback(
    (item: DragItem, x: number, y: number) => {
      draggingRef.current = item;
      last.current = { x, y };
      pointer.setValue({ x, y });
      setDragging(item);
      haptics.light();
      measureTargets();
      // Measure again once the drop bar has been laid out.
      setTimeout(measureTargets, 120);
    },
    [measureTargets, pointer],
  );

  const move = useCallback(
    (x: number, y: number) => {
      const item = draggingRef.current;
      if (!item) return;
      last.current = { x, y };
      pointer.setValue({ x, y });
      const key = hitTarget(item, x, y);
      setHovered((h) => (h === key ? h : key));
    },
    [hitTarget, pointer],
  );

  const finish = useCallback(async () => {
    const item = draggingRef.current;
    draggingRef.current = null;
    if (!item) return;
    const { x, y } = last.current;
    try {
      await measureTargets();
      const key = hitTarget(item, x, y);
      if (key) {
        targets.current.get(key)!.onDrop(item);
        haptics.success();
        return;
      }
      for (const [listKey, list] of lists.current) {
        if (!list.accepts(item)) continue;
        const listRect = await measure(list.ref);
        if (!inside(listRect, x, y)) continue;
        const listRows = [...(rows.current.get(listKey) ?? new Map()).entries()];
        const measured = await Promise.all(listRows.map(([, ref]) => measure(ref)));
        const ordered = listRows
          .map(([id], i) => ({ id, rect: measured[i] }))
          .filter((r): r is { id: string; rect: Rect } => r.rect !== null)
          .sort((a, b) => a.rect.y - b.rect.y);
        const draggedId = "id" in item ? item.id : null;
        const before = ordered.find((r) => r.id !== draggedId && r.rect.y + r.rect.height / 2 > y);
        list.onDrop(item, before?.id ?? null);
        haptics.success();
        return;
      }
    } finally {
      setDragging(null);
      setHovered(null);
    }
  }, [hitTarget, measureTargets]);

  const cancel = useCallback(() => {
    draggingRef.current = null;
    setDragging(null);
    setHovered(null);
  }, []);

  const api = useMemo<DragApi>(
    () => ({
      dragging,
      hovered,
      registerTarget(key, target) {
        targets.current.set(key, target);
        return () => {
          if (targets.current.get(key) === target) targets.current.delete(key);
        };
      },
      registerList(key, list) {
        lists.current.set(key, list);
        return () => {
          if (lists.current.get(key) === list) lists.current.delete(key);
        };
      },
      registerRow(listKey, id, ref) {
        let map = rows.current.get(listKey);
        if (!map) rows.current.set(listKey, (map = new Map()));
        map.set(id, ref);
        return () => {
          if (map!.get(id) === ref) map!.delete(id);
        };
      },
      setNewToDoOpener(open) {
        newOpener.current = open;
      },
      openNewToDo(spot) {
        newOpener.current?.(spot);
      },
    }),
    [dragging, hovered],
  );

  // Exposed for Magic Plus, which decides itself when a press becomes a drag.
  const manual = useMemo(() => ({ start, move, finish, cancel }), [start, move, finish, cancel]);

  return (
    <Context.Provider value={api}>
      <ManualContext.Provider value={manual}>
        {children}
        {dragging ? (
          <>
            <DropBar />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ghost,
                { backgroundColor: theme.surface, borderColor: theme.accent },
                { transform: [{ translateX: pointer.x }, { translateY: pointer.y }] },
              ]}
              testID="drag-ghost"
            >
              <Text style={{ color: theme.text }} numberOfLines={1}>
                {dragging.kind === "new" ? "＋ New To-do" : dragging.title}
              </Text>
            </Animated.View>
          </>
        ) : null}
      </ManualContext.Provider>
    </Context.Provider>
  );
}

const ManualContext = createContext<{
  start(item: DragItem, x: number, y: number): void;
  move(x: number, y: number): void;
  finish(): Promise<void>;
  cancel(): void;
} | null>(null);

export function useDrag(): DragApi {
  const api = useContext(Context);
  if (!api) throw new Error("useDrag must be used inside DragProvider");
  return api;
}

export function useManualDrag() {
  const api = useContext(ManualContext);
  if (!api) throw new Error("useManualDrag must be used inside DragProvider");
  return api;
}

/**
 * A drag handle: dragging starts as soon as it is touched. It is a Pressable that does nothing
 * on press, so a row it sits in does not take the touch (or, on the web, the click) as its own.
 */
export function DragHandle({
  item,
  style,
  testID,
  accessibilityLabel,
  children,
}: {
  item: DragItem;
  style: StyleProp<ViewStyle>;
  testID: string;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const manual = useManualDrag();
  const gesture = usePanGesture({
    minDistance: 0,
    onActivate: (e) => manual.start(item, e.absoluteX, e.absoluteY),
    onUpdate: (e) => manual.move(e.absoluteX, e.absoluteY),
    onDeactivate: (e) => (e.canceled ? manual.cancel() : manual.finish()),
  });
  return (
    <GestureDetector gesture={gesture}>
      <Pressable style={style} testID={testID} accessibilityLabel={accessibilityLabel}>
        {children}
      </Pressable>
    </GestureDetector>
  );
}

/** Registers a view as somewhere items can be dropped. Returns its ref. */
export function useDropTarget(key: string, target: Omit<Target, "ref">): Measurable {
  const drag = useDrag();
  const ref = useRef<ViewNode>(null);
  const latest = useRef(target);
  useEffect(() => {
    latest.current = target;
  });
  useEffect(
    () =>
      drag.registerTarget(key, {
        ref,
        accepts: (item) => latest.current.accepts(item),
        onDrop: (item) => latest.current.onDrop(item),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, drag.registerTarget],
  );
  return ref;
}

/** Registers a view as a list items can be dropped into, at a spot between its rows. */
export function useDropList(key: string, list: Omit<DropList, "ref">): Measurable {
  const drag = useDrag();
  const ref = useRef<ViewNode>(null);
  const latest = useRef(list);
  useEffect(() => {
    latest.current = list;
  });
  useEffect(
    () =>
      drag.registerList(key, {
        ref,
        accepts: (item) => latest.current.accepts(item),
        onDrop: (item, beforeId) => latest.current.onDrop(item, beforeId),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, drag.registerList],
  );
  return ref;
}

/** Registers a row of a drop list, so drops can land before it. */
export function useDropRow(listKey: string | undefined, id: string): Measurable {
  const drag = useDrag();
  const ref = useRef<ViewNode>(null);
  useEffect(
    () => (listKey ? drag.registerRow(listKey, id, ref) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listKey, id, drag.registerRow],
  );
  return ref;
}

/** What a new To-do gets from the list it is created in. */
export function placementForList(list: ListRef): Omit<NewToDo, "title"> {
  switch (list.kind) {
    case "today":
      return { when: { kind: list.part === "main" ? "today" : "thisEvening" } };
    case "someday":
      return { when: { kind: "someday" } };
    case "area":
      return { areaId: list.id };
    case "project":
      return { projectId: list.id };
    case "heading":
      return { headingId: list.id };
    default:
      return {};
  }
}

function placementForTarget(target: DropTarget): Omit<NewToDo, "title"> {
  switch (target.kind) {
    case "today":
      return { when: { kind: "today" } };
    case "someday":
      return { when: { kind: "someday" } };
    case "area":
      return { areaId: target.id };
    case "project":
      return { projectId: target.id };
    case "heading":
      return { headingId: target.id };
    case "inbox":
      return {};
  }
}

/** Drop handling for a list of To-dos: reorder, file, or create a new To-do at the spot. */
export function toDoListDrop(app: MyThings, drag: DragApi, list: ListRef): Omit<DropList, "ref"> {
  return {
    accepts: (item) => item.kind === "toDo" || item.kind === "new",
    onDrop: (item, beforeId) => {
      if (item.kind === "toDo") app.placeToDo(list, item.id, beforeId);
      else if (item.kind === "new") {
        drag.openNewToDo({ placement: placementForList(list), at: { list, beforeId } });
      }
    },
  };
}

/** Drop handling for a target such as the Inbox, a Project or a Heading. */
export function toDoTargetDrop(
  app: MyThings,
  drag: DragApi,
  target: DropTarget,
): Omit<Target, "ref"> {
  const filesIt = target.kind !== "today" && target.kind !== "someday";
  return {
    accepts: (item) =>
      item.kind === "new" || (item.kind === "toDo" && !(filesIt && item.isSubToDo)),
    onDrop: (item) => {
      if (item.kind === "toDo") app.dropToDo(item.id, target);
      else if (item.kind === "new") drag.openNewToDo({ placement: placementForTarget(target) });
    },
  };
}

function DropChip({
  keyName,
  title,
  target,
}: {
  keyName: string;
  title: string;
  target: DropTarget;
}) {
  const app = useMyThings();
  const drag = useDrag();
  const theme = useTheme();
  const ref = useDropTarget(`bar-${keyName}`, toDoTargetDrop(app, drag, target));
  const hovered = drag.hovered === `bar-${keyName}`;
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        styles.chip,
        { borderColor: theme.accent, backgroundColor: hovered ? theme.accent : theme.surface },
      ]}
      testID={`drop-${keyName}`}
    >
      <Text style={{ color: hovered ? theme.onAccent : theme.text, fontSize: 13 }}>{title}</Text>
    </View>
  );
}

/** While a To-do or Magic Plus is dragged: places to drop it on, at the top of the screen. */
function DropBar() {
  const app = useMyThings();
  const drag = useDrag();
  const theme = useTheme();
  const item = drag.dragging;
  if (!item || (item.kind !== "toDo" && item.kind !== "new")) return null;
  const tree = app.sidebar();
  const projects = [...tree.projects, ...tree.areas.flatMap((a) => a.projects)];
  return (
    <View
      pointerEvents="none"
      style={[styles.bar, { backgroundColor: theme.background, borderColor: theme.border }]}
      testID="drop-bar"
    >
      <Text style={[styles.barTitle, { color: theme.muted }]}>Drop on a list, or in place</Text>
      <View style={styles.chips}>
        <DropChip keyName="inbox" title="📥 Inbox" target={{ kind: "inbox" }} />
        <DropChip keyName="today" title="☀️ Today" target={{ kind: "today" }} />
        <DropChip keyName="someday" title="📦 Someday" target={{ kind: "someday" }} />
        {tree.areas.map(({ area }) => (
          <DropChip
            key={area.id}
            keyName={`area-${area.id}`}
            title={`▣ ${area.title}`}
            target={{ kind: "area", id: area.id }}
          />
        ))}
        {projects.map((p) => (
          <DropChip
            key={p.id}
            keyName={`project-${p.id}`}
            title={`◔ ${p.title}`}
            target={{ kind: "project", id: p.id }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: "absolute",
    left: -40,
    top: -22,
    maxWidth: 240,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    opacity: 0.95,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barTitle: { fontSize: 12, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
});
