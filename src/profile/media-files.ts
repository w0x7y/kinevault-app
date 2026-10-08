import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat, type ImageRef } from "expo-image-manipulator";
import {
  MediaIdentityCollisionError,
  fitPhotoDimensions,
  isSafeMediaId,
  validatePhotoSource,
  type MediaFiles,
} from "./media-model";

function ownedFiles(id: string) {
  if (!isSafeMediaId(id)) throw new Error("Invalid photo identity");
  const directory = new Directory(Paths.document, "profile-media-v1");
  return {
    directory,
    original: new File(directory, `${id}.jpg`),
    thumbnail: new File(directory, `${id}.thumb.jpg`),
  };
}
function deleteFile(file: File) {
  if (file.exists) file.delete();
}
function discardFile(file: File) {
  try {
    deleteFile(file);
  } catch {
    /* A leftover owned file must not undo a saved record. */
  }
}
async function resizedCopy(uri: string, maximum: number, quality: number) {
  const context = ImageManipulator.manipulate(uri);
  let rendered: ImageRef | undefined;
  try {
    rendered = await context.renderAsync();
    const dimensions = fitPhotoDimensions(rendered.width, rendered.height, maximum);
    if (rendered.width !== dimensions.width || rendered.height !== dimensions.height) {
      context.resize(dimensions);
      rendered.release();
      rendered = undefined;
      rendered = await context.renderAsync();
    }
    return await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality });
  } finally {
    rendered?.release();
    context.release();
  }
}

export function createMediaFiles(): MediaFiles {
  return {
    async assertAvailable(id) {
      const files = ownedFiles(id);
      if (files.original.exists || files.thumbnail.exists) throw new MediaIdentityCollisionError();
    },
    async importPhoto(source, id) {
      validatePhotoSource(source);
      const files = ownedFiles(id);
      files.directory.create({ idempotent: true, intermediates: true });
      if (files.original.exists || files.thumbnail.exists) throw new MediaIdentityCollisionError();
      const temporary: File[] = [];
      try {
        const original = await resizedCopy(source.uri, 1600, 0.85);
        const originalFile = new File(original.uri);
        temporary.push(originalFile);
        await originalFile.copy(files.original);
        const thumbnail = await resizedCopy(original.uri, 320, 0.75);
        const thumbnailFile = new File(thumbnail.uri);
        temporary.push(thumbnailFile);
        await thumbnailFile.copy(files.thumbnail);
        if (!files.original.size || !files.thumbnail.size)
          throw new Error("This photo could not be saved");
        return { id, width: original.width, height: original.height };
      } catch (error) {
        discardFile(files.original);
        discardFile(files.thumbnail);
        throw error;
      } finally {
        for (const file of temporary) discardFile(file);
      }
    },
    async resolvePhoto(image, thumbnail = false) {
      const files = ownedFiles(image.id);
      const file = thumbnail ? files.thumbnail : files.original;
      if (!file.exists || !file.size) throw new Error("Photo unavailable");
      return file.uri;
    },
    async removePhoto(image) {
      const files = ownedFiles(image.id);
      // Attempt both versions even if the first removal fails.
      let failure: unknown;
      for (const file of [files.original, files.thumbnail]) {
        try {
          deleteFile(file);
        } catch (error) {
          failure = error;
        }
      }
      if (failure) throw failure;
    },
    releaseUri() {
      /* Native file URIs do not allocate browser resources. */
    },
  };
}
export const mediaFiles = createMediaFiles();
