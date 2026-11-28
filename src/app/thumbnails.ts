// Thumbnails made on the device with expo-image-manipulator, which runs in Expo Go and
// on the web; Supabase's image transformations would need a paid plan (M3-05).
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { PickedFile } from "./attachments";
import type { FileBody } from "./fileStorage";

/** The longer side of a thumbnail, in pixels. */
export const thumbnailSize = 256;

/**
 * For an image, adds its size in pixels and a JPEG thumbnail 256 px on its longer side.
 * A file that isn't an image, or one the device can't read as one (HEIC on some
 * browsers), is attached as any other file.
 */
export async function withThumbnail(
  file: PickedFile,
  uri: string,
  read: (uri: string) => () => Promise<FileBody>,
): Promise<PickedFile> {
  if (!file.mimeType.startsWith("image/")) return file;
  try {
    const image = await ImageManipulator.manipulate(uri).renderAsync();
    const { width, height } = image;
    const size = width >= height ? { width: thumbnailSize } : { height: thumbnailSize };
    return {
      ...file,
      width,
      height,
      async thumbnail() {
        const small = await ImageManipulator.manipulate(uri).resize(size).renderAsync();
        const saved = await small.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
        return read(saved.uri)();
      },
    };
  } catch (error) {
    console.warn("Not read as an image", error);
    return file;
  }
}
