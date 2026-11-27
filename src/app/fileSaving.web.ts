// Saving and picking files on the web. Expo Go uses fileSaving.ts.
import * as DocumentPicker from "expo-document-picker";

/** Downloads a text file through a Blob link. */
export async function saveFile(name: string, text: string, mimeType: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the Blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lets the user pick a file of this type and returns its text, or null if they cancelled. */
export async function pickTextFile(mimeType: string): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: mimeType, base64: false });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;
  if (asset.file) return asset.file.text();
  return (await fetch(asset.uri)).text();
}
