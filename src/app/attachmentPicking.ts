// Picking files to attach and opening them, in Expo Go (iPhone and Android). The web
// has its own version in attachmentPicking.web.ts, since expo-file-system doesn't run
// there. Every module here is bundled in Expo Go (ADR 0003).
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";
import type { Opening, PickedFile } from "./attachments";
import { withThumbnail } from "./thumbnails";

const read = (uri: string) => () => new File(uri).arrayBuffer();

/** Lets the user pick a photo from the library, or returns null if they cancelled. */
export async function pickPhoto(): Promise<PickedFile | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;
  const file: PickedFile = {
    name: asset.fileName ?? `Photo ${new Date().toISOString().slice(0, 10)}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
    size: asset.fileSize ?? new File(asset.uri).size,
    read: read(asset.uri),
  };
  return withThumbnail(file, asset.uri, read);
}

/** Lets the user pick any file, or returns null if they cancelled. */
export async function pickDocument(): Promise<PickedFile | null> {
  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;
  const file: PickedFile = {
    name: asset.name,
    mimeType: asset.mimeType ?? "application/octet-stream",
    size: asset.size ?? new File(asset.uri).size,
    read: read(asset.uri),
  };
  return withThumbnail(file, asset.uri, read);
}

/** Opens a file's link in the system browser, which previews most file types. */
export function startOpening(): Opening {
  return {
    go: (url) => void Linking.openURL(url),
    cancel: () => {},
  };
}
