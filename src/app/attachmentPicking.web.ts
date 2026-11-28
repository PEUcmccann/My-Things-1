// Picking files to attach and opening them on the web. Expo Go uses attachmentPicking.ts.
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import type { Opening, PickedFile } from "./attachments";
import { withThumbnail } from "./thumbnails";

const read = (uri: string) => async () => (await fetch(uri)).blob();

/** Reads the picked File itself where the browser gives one, else its URI. */
const readPicked = (uri: string, file: Blob | undefined) => (file ? async () => file : read(uri));

/** Lets the user pick a photo, or returns null if they cancelled. */
export async function pickPhoto(): Promise<PickedFile | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;
  const file: PickedFile = {
    name: asset.file?.name ?? asset.fileName ?? "Photo.jpg",
    mimeType: asset.mimeType ?? asset.file?.type ?? "image/jpeg",
    size: asset.fileSize ?? asset.file?.size ?? (await read(asset.uri)()).size,
    read: readPicked(asset.uri, asset.file),
  };
  return withThumbnail(file, asset.uri, read);
}

/** Lets the user pick any file, or returns null if they cancelled. */
export async function pickDocument(): Promise<PickedFile | null> {
  const picked = await DocumentPicker.getDocumentAsync({ base64: false });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;
  const file: PickedFile = {
    name: asset.name,
    mimeType: asset.mimeType || asset.file?.type || "application/octet-stream",
    size: asset.size ?? asset.file?.size ?? 0,
    read: readPicked(asset.uri, asset.file),
  };
  return withThumbnail(file, asset.uri, read);
}

/**
 * Opens a new tab at once, while the tap still counts as the user's (so it isn't
 * blocked as a pop-up), and points it at the file once its link arrives.
 */
export function startOpening(): Opening {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  return {
    go(url) {
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    },
    cancel: () => tab?.close(),
  };
}
