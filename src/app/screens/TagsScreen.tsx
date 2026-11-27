import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Empty } from "../components/Empty";
import { MenuSheet } from "../components/MenuSheet";
import { PromptSheet } from "../components/PromptSheet";
import { Screen } from "../components/Screen";
import { useNavigation } from "../navigation";
import { useMyThings } from "../state";
import { useTheme } from "../theme";

type Dialog = { kind: "new" } | { kind: "menu" | "rename" | "nest" | "delete"; id: string } | null;

/** Manage Tags: create, rename, nest, un-nest and delete them. */
export function TagsScreen() {
  const app = useMyThings();
  const theme = useTheme();
  const nav = useNavigation();
  const [dialog, setDialog] = useState<Dialog>(null);
  const tree = app.tagTree();
  const close = () => setDialog(null);
  const current = dialog && dialog.kind !== "new" ? app.findTag(dialog.id) : undefined;

  // A Tag can go under any Tag except itself and the Tags nested under it.
  const nestOptions = () => {
    if (!current) return [];
    const blocked = new Set([current.id]);
    for (const { tag } of tree) if (tag.parentId && blocked.has(tag.parentId)) blocked.add(tag.id);
    return [
      { title: "No parent (top level)", onPress: () => app.setTagParent(current.id, null) },
      ...tree
        .filter(({ tag }) => !blocked.has(tag.id))
        .map(({ tag, depth }) => ({
          title: tag.title,
          depth,
          onPress: () => app.setTagParent(current.id, tag.id),
          testID: `nest-under-${tag.id}`,
        })),
    ];
  };

  return (
    <Screen
      title="Tags"
      testID="screen-tags"
      actions={
        <Button
          small
          title="＋ New Tag"
          onPress={() => setDialog({ kind: "new" })}
          testID="new-tag"
        />
      }
    >
      {tree.length === 0 ? <Empty text="No Tags yet" /> : null}
      {tree.map(({ tag, depth }) => (
        <View
          key={tag.id}
          style={[
            styles.row,
            { marginLeft: depth * 20, backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Pressable
            style={styles.title}
            onPress={() => nav.push({ name: "tag", id: tag.id })}
            testID={`tag-row-${tag.id}`}
          >
            <Text style={{ color: theme.text, fontSize: 16 }}>🏷 {tag.title}</Text>
          </Pressable>
          <Button
            small
            title="•••"
            onPress={() => setDialog({ kind: "menu", id: tag.id })}
            testID={`tag-menu-${tag.id}`}
          />
        </View>
      ))}
      {dialog?.kind === "new" ? (
        <PromptSheet
          title="New Tag"
          placeholder="Tag name"
          confirmTitle="Create"
          onSubmit={(t) => app.createTag(t)}
          onClose={close}
        />
      ) : null}
      <MenuSheet
        visible={dialog?.kind === "menu"}
        title={current?.title}
        onClose={close}
        options={
          current
            ? [
                {
                  title: "Rename",
                  onPress: () => setDialog({ kind: "rename", id: current.id }),
                  testID: "tag-rename",
                },
                {
                  title: "Nest under…",
                  onPress: () => setDialog({ kind: "nest", id: current.id }),
                  testID: "tag-nest",
                },
                {
                  title: "Delete",
                  danger: true,
                  onPress: () => setDialog({ kind: "delete", id: current.id }),
                  testID: "tag-delete",
                },
              ]
            : []
        }
      />
      <MenuSheet
        visible={dialog?.kind === "nest"}
        title={`Put “${current?.title ?? ""}” under`}
        onClose={close}
        options={nestOptions()}
      />
      <MenuSheet
        visible={dialog?.kind === "delete"}
        title={`Delete “${current?.title ?? ""}”?`}
        message="It will be removed from every item. Tags nested under it move up a level."
        onClose={close}
        options={
          current
            ? [
                {
                  title: "Delete Tag",
                  danger: true,
                  onPress: () => app.deleteTag(current.id),
                  testID: "tag-delete-confirm",
                },
              ]
            : []
        }
      />
      {dialog?.kind === "rename" && current ? (
        <PromptSheet
          title="Rename Tag"
          initial={current.title}
          onSubmit={(t) => app.renameTag(current.id, t)}
          onClose={close}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  title: { flex: 1, paddingVertical: 8 },
});
