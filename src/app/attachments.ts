import { AttachmentError, type Attachment, type MyThings } from "../core";
import { StorageError, storageError, type FileBody, type FileStorage } from "./fileStorage";

// Adding, removing and opening Attachments: the files go to Storage, the details to the
// core. The record is added only once its files are stored, so a failed upload leaves
// nothing behind (M3-05).

/** How long a link to open an Attachment works. */
export const openLinkSeconds = 60 * 60;

/** A file the user picked, read only when it is uploaded. */
export interface PickedFile {
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  read(): Promise<FileBody>;
  /** An image's JPEG thumbnail, made on the device. */
  thumbnail?(): Promise<FileBody>;
}

/** A file being opened in the browser: started on the tap, given its link once it arrives. */
export interface Opening {
  go(url: string): void;
  cancel(): void;
}

/** An upload that failed; its message is what the app shows. */
export class UploadError extends Error {
  constructor(name: string) {
    super(`Couldn't upload ${name}. Try again.`);
    this.name = "UploadError";
  }
}

/**
 * Uploads a picked file (and its thumbnail) to the To-do's Attachment paths, then adds
 * the Attachment. Throws an AttachmentError (over 25 MB, signed out) before uploading,
 * or an UploadError once the files that did upload have been deleted again.
 */
export async function uploadAttachment(
  app: Pick<MyThings, "prepareAttachment" | "addAttachment">,
  storage: FileStorage,
  toDoId: string,
  file: PickedFile,
): Promise<string> {
  const prepared = app.prepareAttachment(toDoId, {
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    width: file.width,
    height: file.height,
    thumbnail: Boolean(file.thumbnail),
  });
  const uploaded: string[] = [];
  try {
    await storage.upload(prepared.storagePath, await file.read(), file.mimeType);
    uploaded.push(prepared.storagePath);
    if (file.thumbnail && prepared.thumbnailPath) {
      await storage.upload(prepared.thumbnailPath, await file.thumbnail(), "image/jpeg");
      uploaded.push(prepared.thumbnailPath);
    }
  } catch (error) {
    console.warn("Attachment upload failed", error);
    await storage.remove(uploaded).catch(() => {});
    throw new UploadError(file.name);
  }
  return app.addAttachment(prepared);
}

/**
 * Deletes removed Attachments' files. Files that can't be deleted now (offline, signed
 * out) stay in Storage: losing nothing matters more than a little space.
 */
export async function deleteAttachmentFiles(
  storage: FileStorage | null,
  removed: Pick<Attachment, "storagePath" | "thumbnailPath">[],
): Promise<void> {
  const paths = removed.flatMap((a) => [
    a.storagePath,
    ...(a.thumbnailPath ? [a.thumbnailPath] : []),
  ]);
  if (!storage || paths.length === 0) return;
  await storage.remove(paths).catch((error: unknown) => {
    console.warn("Attachment files left in Storage", storageError(error).message);
  });
}

/**
 * Replaces everything with an export's contents, from a file or a Backup, then empties
 * Trash older than 30 days in it, as when the app opens. Throws a RestoreError,
 * changing nothing, before it starts. The returned promise settles once the files of
 * Attachments the restore removed are deleted, when they can be.
 */
export function restoreEverything(
  app: Pick<MyThings, "restoreExport" | "purgeExpiredTrash">,
  storage: FileStorage | null,
  text: string,
): Promise<void> {
  const removed = app.restoreExport(text);
  return deleteAttachmentFiles(storage, [...removed, ...app.purgeExpiredTrash()]);
}

export type OpenResult = { kind: "url"; url: string } | { kind: "problem"; text: string };

/** Why a file can't be read from Storage, as the app says it. */
export function storageProblemText(error: unknown): string {
  const { kind } = error instanceof StorageError ? error : storageError(error);
  if (kind === "missing") return "File not available";
  if (kind === "offline") return "You're offline";
  return "Couldn't open the file. Try again.";
}

/** A link valid for an hour to a stored file, or why there is none. */
export async function signedLink(storage: FileStorage, path: string): Promise<OpenResult> {
  try {
    return { kind: "url", url: await storage.signedUrl(path, openLinkSeconds) };
  } catch (error) {
    return { kind: "problem", text: storageProblemText(error) };
  }
}

/** A link valid for an hour to open an Attachment's file, or why it can't be opened. */
export function openAttachmentUrl(
  storage: FileStorage,
  attachment: Pick<Attachment, "storagePath">,
): Promise<OpenResult> {
  return signedLink(storage, attachment.storagePath);
}

/** What the app says when an Attachment can't be added. */
export function addProblemText(error: unknown): string {
  if (error instanceof AttachmentError || error instanceof UploadError) return error.message;
  return "Couldn't add the attachment. Try again.";
}

/** A file size as people read it, e.g. "2.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? Math.round(mb * 10) / 10 : Math.round(mb)} MB`;
}

export type AttachmentKind = "image" | "pdf" | "spreadsheet" | "document" | "other";

const spreadsheetNames = /\.(xlsx?|xlsm|csv|tsv|ods|numbers)$/i;
const documentNames = /\.(docx?|txt|md|rtf|odt|pages|key|pptx?)$/i;

/** Which icon a file shows, from its MIME type or, failing that, its name. */
export function attachmentKind(mimeType: string, name: string): AttachmentKind {
  const type = mimeType.toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (/spreadsheet|excel|csv|tab-separated/.test(type) || spreadsheetNames.test(name)) {
    return "spreadsheet";
  }
  if (
    type.startsWith("text/") ||
    /word|document|rtf|presentation|powerpoint/.test(type) ||
    documentNames.test(name)
  ) {
    return "document";
  }
  return "other";
}
