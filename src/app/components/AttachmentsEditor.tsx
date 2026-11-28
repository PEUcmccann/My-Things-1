import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Attachment } from "../../core";
import { pickDocument, pickPhoto, startOpening } from "../attachmentPicking";
import {
  addProblemText,
  attachmentKind,
  deleteAttachmentFiles,
  formatFileSize,
  signedLink,
  attachPicked,
  type PickedFile,
} from "../attachments";
import type { FileStorage } from "../fileStorage";
import { useAttachmentStorage, useMyThings } from "../state";
import { useTheme } from "../theme";
import { Button } from "./Button";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { MenuSheet } from "./MenuSheet";

const kindIcons: Record<ReturnType<typeof attachmentKind>, IconName> = {
  image: "image",
  pdf: "pdf",
  spreadsheet: "spreadsheet",
  document: "document",
  other: "file",
};

/** An Attachment on its way to Storage, shown until it is added. */
interface Attaching {
  key: number;
  name: string;
  size: number;
}

let nextKey = 0;

/** A To-do's Attachments: thumbnails or icons, adding, opening and removing. */
export function AttachmentsEditor({ toDoId }: { toDoId: string }) {
  const app = useMyThings();
  const theme = useTheme();
  const { storage, unavailable } = useAttachmentStorage();
  const [menu, setMenu] = useState(false);
  const [attaching, setAttaching] = useState<Attaching[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const attachments = app.attachments(toDoId);

  async function add(pick: () => Promise<PickedFile | null>) {
    setMessage(null);
    let picked: PickedFile | null;
    try {
      picked = await pick();
    } catch (error) {
      console.warn("Picking a file failed", error);
      return;
    }
    if (!picked || !storage) return;
    const row = { key: ++nextKey, name: picked.name, size: picked.size };
    setAttaching((rows) => [...rows, row]);
    try {
      await attachPicked(app, storage, toDoId, picked);
    } catch (error) {
      setMessage(addProblemText(error));
    } finally {
      setAttaching((rows) => rows.filter((r) => r.key !== row.key));
    }
  }

  async function open(attachment: Attachment) {
    if (!storage) {
      setProblems((p) => ({ ...p, [attachment.id]: "Sign in to open attachments" }));
      return;
    }
    const isImage = attachmentKind(attachment.mimeType, attachment.name) === "image";
    const opening = isImage ? null : startOpening();
    const link = await signedLink(storage, attachment.storagePath);
    if (link.kind === "problem") {
      opening?.cancel();
      setProblems((p) => ({ ...p, [attachment.id]: link.text }));
      return;
    }
    setProblems(({ [attachment.id]: _gone, ...rest }) => rest);
    if (opening) opening.go(link.url);
    else setViewing(link.url);
  }

  function remove(attachment: Attachment) {
    const removed = app.removeAttachment(attachment.id);
    void deleteAttachmentFiles(storage, [removed]);
  }

  return (
    <View style={styles.section} testID="attachments">
      {attachments.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => void open(a)}
          style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surface }]}
          testID={`attachment-${a.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Open ${a.name}`}
        >
          <Preview
            attachment={a}
            storage={storage}
            onMissing={(text) => setProblems((p) => ({ ...p, [a.id]: text }))}
          />
          <View style={styles.body}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {a.name}
            </Text>
            <Text style={[styles.detail, { color: theme.muted }]}>{formatFileSize(a.size)}</Text>
            {problems[a.id] ? (
              <Text
                style={[styles.detail, { color: theme.danger }]}
                testID={`attachment-problem-${a.id}`}
              >
                {problems[a.id]}
              </Text>
            ) : null}
          </View>
          <Button
            small
            icon="close"
            iconColor={theme.muted}
            accessibilityLabel={`Remove ${a.name}`}
            onPress={() => setRemoving(a)}
            testID={`attachment-remove-${a.id}`}
          />
        </Pressable>
      ))}
      {attaching.map((u) => (
        <View
          key={u.key}
          style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surface }]}
          testID="attachment-attaching"
        >
          <View style={[styles.thumb, styles.iconBox]}>
            <Icon name="attachment" size={22} color={theme.muted} />
          </View>
          <View style={styles.body}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {u.name}
            </Text>
            <Text style={[styles.detail, { color: theme.muted }]}>Attaching…</Text>
          </View>
        </View>
      ))}
      {message ? (
        <Text style={[styles.message, { color: theme.danger }]} testID="attachment-message">
          {message}
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          if (unavailable) setMessage(unavailable);
          else setMenu(true);
        }}
        style={styles.add}
        testID="attachment-add"
        accessibilityRole="button"
      >
        <Icon name="attachment" size={16} color={theme.accent} />
        <Text style={{ color: theme.accent, fontSize: 15 }}>Add attachment</Text>
      </Pressable>
      <MenuSheet
        visible={menu}
        title="Add attachment"
        onClose={() => setMenu(false)}
        options={[
          {
            title: "Photo",
            icon: "image",
            onPress: () => void add(pickPhoto),
            testID: "attachment-add-photo",
          },
          {
            title: "Document",
            icon: "file",
            onPress: () => void add(pickDocument),
            testID: "attachment-add-document",
          },
        ]}
      />
      <MenuSheet
        visible={removing !== null}
        title={removing ? `Remove “${removing.name}”?` : undefined}
        message="It will be removed from this To-do on every device. This can't be undone."
        onClose={() => setRemoving(null)}
        options={[
          {
            title: "Remove attachment",
            danger: true,
            onPress: () => removing && remove(removing),
            testID: "attachment-remove-confirm",
          },
        ]}
      />
      <Modal
        visible={viewing !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.viewer} testID="attachment-viewer">
          {viewing ? (
            <Image source={{ uri: viewing }} style={styles.full} resizeMode="contain" />
          ) : null}
          <Pressable
            onPress={() => setViewing(null)}
            style={styles.closeViewer}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="attachment-viewer-close"
          >
            <Icon name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/** An image's thumbnail, loaded through a signed link, or an icon by kind. */
function Preview({
  attachment,
  storage,
  onMissing,
}: {
  attachment: Attachment;
  storage: FileStorage | null;
  onMissing: (text: string) => void;
}) {
  const theme = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const path = attachment.thumbnailPath;
  useEffect(() => {
    if (!path || !storage) return;
    let live = true;
    void signedLink(storage, path).then((link) => {
      if (!live) return;
      if (link.kind === "url") setUri(link.url);
      else if (link.text === "Attachment not available") onMissing(link.text);
    });
    return () => {
      live = false;
    };
    // onMissing changes every render; the link only depends on the path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, storage]);
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={styles.thumb}
        testID={`attachment-thumbnail-${attachment.id}`}
        accessibilityLabel={`Thumbnail of ${attachment.name}`}
      />
    );
  }
  return (
    <View style={[styles.thumb, styles.iconBox]} testID={`attachment-icon-${attachment.id}`}>
      <Icon
        name={kindIcons[attachmentKind(attachment.mimeType, attachment.name)]}
        size={22}
        color={theme.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 44, height: 44, borderRadius: 6 },
  iconBox: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  name: { fontSize: 15 },
  detail: { fontSize: 12, marginTop: 2 },
  message: { fontSize: 13, marginLeft: 8 },
  add: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  viewer: { flex: 1, backgroundColor: "#000000", justifyContent: "center" },
  full: { flex: 1 },
  closeViewer: { position: "absolute", top: 48, right: 16, padding: 8 },
});
