import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { mediaFiles } from "../profile/media-files";
import type { StoredPhoto } from "../profile/media-model";

export async function readExportPhoto(photo: StoredPhoto): Promise<string> {
  const uri = await mediaFiles.resolvePhoto(photo);
  try {
    return await new File(uri).base64();
  } finally {
    mediaFiles.releaseUri(uri);
  }
}

export async function saveAccountExport(contents: string, isCurrent: () => boolean): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is unavailable on this device.");
  if (!isCurrent()) throw new Error("The account changed. Start again.");
  const file = new File(
    Paths.cache,
    `kinevault-export-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
  try {
    file.create();
    file.write(contents);
    if (!isCurrent()) throw new Error("The account changed. Start again.");
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      UTI: "public.json",
      dialogTitle: "Save your KineVault export",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
