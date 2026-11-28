import { byCreation, type Context } from "./context";
import { localOwner } from "./owner";
import type { Attachment } from "./types";

/** The largest file a To-do can have attached: 25 MB (plan.md). */
export const maxAttachmentSize = 25 * 1024 * 1024;

/** What the app knows about a picked file before it is uploaded. */
export interface AttachmentDetails {
  name: string;
  mimeType: string;
  /** In bytes. */
  size: number;
  /** An image's size in pixels. */
  width?: number | null;
  height?: number | null;
  /** Whether a thumbnail goes with the file (images only). */
  thumbnail?: boolean;
}

/** An Attachment's record before it is added: the app uploads its files to these paths first. */
export type NewAttachment = Omit<Attachment, "owner" | "createdAt" | "updatedAt">;

/** Why an Attachment can't be added. */
export type AttachmentProblem = "tooLarge" | "signedOut";

export class AttachmentError extends Error {
  constructor(readonly problem: AttachmentProblem) {
    super(
      {
        tooLarge: "Files can be up to 25 MB",
        signedOut: "Sign in to add attachments",
      }[problem],
    );
    this.name = "AttachmentError";
  }
}

/** A file name as it goes in a storage path: only letters, digits, ".", "-" and "_". */
export function attachmentPathName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_") || "_";
}

export function attachmentActions(ctx: Context) {
  const { store } = ctx;

  function check(toDoId: string, size: number): void {
    ctx.require("toDos", toDoId);
    if (ctx.owner === localOwner) throw new AttachmentError("signedOut");
    if (size > maxAttachmentSize) throw new AttachmentError("tooLarge");
  }

  return {
    /**
     * The record an Attachment will have, with the paths its file and thumbnail go to
     * in the account's folder. Nothing is stored yet: the app uploads the files, then
     * calls `addAttachment`, so a failed upload leaves nothing behind. Throws an
     * AttachmentError over 25 MB or while signed out.
     */
    prepareAttachment(toDoId: string, details: AttachmentDetails): NewAttachment {
      check(toDoId, details.size);
      const id = ctx.meta().id;
      const folder = `${ctx.owner}/${id}`;
      return {
        id,
        toDoId,
        name: details.name,
        mimeType: details.mimeType,
        size: details.size,
        storagePath: `${folder}/${attachmentPathName(details.name)}`,
        thumbnailPath: details.thumbnail ? `${folder}/thumbnail.jpg` : null,
        width: details.width ?? null,
        height: details.height ?? null,
      };
    },

    /** Adds a prepared Attachment to its To-do, once its files are uploaded. */
    addAttachment(prepared: NewAttachment): string {
      check(prepared.toDoId, prepared.size);
      const at = ctx.now();
      store.put("attachments", { ...prepared, owner: ctx.owner, createdAt: at, updatedAt: at });
      return prepared.id;
    },

    /** Removes an Attachment for good, on every device. Returns it, so its files can be deleted. */
    removeAttachment(id: string): Attachment {
      const attachment = ctx.require("attachments", id);
      store.remove("attachments", id);
      return attachment;
    },

    /** A To-do's Attachments, oldest first. */
    attachments(toDoId: string): Attachment[] {
      return store
        .all("attachments")
        .filter((a) => a.toDoId === toDoId)
        .sort(byCreation);
    },

    hasAttachments(toDoId: string): boolean {
      return store.all("attachments").some((a) => a.toDoId === toDoId);
    },
  };
}
