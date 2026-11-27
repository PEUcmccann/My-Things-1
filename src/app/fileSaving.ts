// Saving and picking files in Expo Go (iPhone and Android). The web has its own
// version in fileSaving.web.ts, since expo-file-system doesn't run there.
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/** iOS type identifiers for the share sheet. */
const utis: Record<string, string> = {
  "application/json": "public.json",
  "text/csv": "public.comma-separated-values-text",
};

/**
 * Offers a text file to the user: written to the cache directory, then the share
 * sheet, so it can be saved to Files or sent. Resolves once the sheet is closed.
 */
export async function saveFile(name: string, text: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, {
    mimeType,
    UTI: utis[mimeType],
    dialogTitle: name,
  });
}

/** Lets the user pick a file of this type and returns its text, or null if they cancelled. */
export async function pickTextFile(mimeType: string): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: mimeType,
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  return new File(picked.assets[0].uri).text();
}
