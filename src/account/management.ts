import type { AccountStorage } from "./storage.ts";
import type { StoredPhoto } from "../profile/media-model.ts";

function checkOwner(storage: AccountStorage, ownerId: string, isCurrent: () => boolean) {
  if (storage.ownerId !== ownerId || !isCurrent())
    throw new Error("The account changed. Start again.");
}

export async function buildAccountExport({
  storage,
  ownerId,
  isCurrent,
  includeCloud,
  readPhoto,
  now = () => new Date(),
}: {
  storage: AccountStorage;
  ownerId: string;
  isCurrent: () => boolean;
  includeCloud: boolean;
  readPhoto: (photo: StoredPhoto) => Promise<string>;
  now?: () => Date;
}) {
  checkOwner(storage, ownerId, isCurrent);
  const saved = await storage.exportDocuments(includeCloud);
  checkOwner(storage, ownerId, isCurrent);
  const images = [
    ...(saved.media.avatar ? [saved.media.avatar] : []),
    ...saved.media.photos.map((photo) => photo.image),
  ];
  const photos = [];
  for (const image of images) {
    const base64 = await readPhoto(image);
    checkOwner(storage, ownerId, isCurrent);
    // Files must contain a JPEG, not merely metadata or a nonempty placeholder.
    let jpeg = "";
    try {
      jpeg = atob(base64);
    } catch {
      /* Invalid base64 remains a failed photo. */
    }
    if (
      !/^\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(base64) ||
      jpeg.length < 5 ||
      jpeg.charCodeAt(0) !== 255 ||
      jpeg.charCodeAt(1) !== 216 ||
      jpeg.charCodeAt(2) !== 255 ||
      jpeg.charCodeAt(jpeg.length - 2) !== 255 ||
      jpeg.charCodeAt(jpeg.length - 1) !== 217
    )
      throw new Error(
        "A saved photo could not be exported. Restore or remove the missing photo and retry.",
      );
    photos.push({ ...image, mimeType: "image/jpeg", encoding: "base64", contents: base64 });
  }
  return JSON.stringify(
    {
      format: "kinevault-track-account-export",
      version: 1,
      ownerId,
      exportedAt: now().toISOString(),
      cloudStatus: includeCloud ? "included" : "not-requested-device-copy-only",
      documents: saved.documents,
      recoveredSetup: saved.recoveredSetup,
      media: saved.media,
      photos,
    },
    null,
    2,
  );
}

export async function deleteAccountData({
  storage,
  ownerId,
  isCurrent,
  password,
  confirmation,
  deleteOnServer,
  removePhoto,
}: {
  storage: AccountStorage;
  ownerId: string;
  isCurrent: () => boolean;
  password: string;
  confirmation: string;
  deleteOnServer: (password: string) => Promise<void>;
  removePhoto: (photo: StoredPhoto) => Promise<void>;
}): Promise<string | null> {
  checkOwner(storage, ownerId, isCurrent);
  if (confirmation !== "DELETE" || !password || password.length > 128)
    throw new Error("Enter your password and type DELETE to confirm.");
  const frozen = await storage.freezeForDeletion();
  try {
    checkOwner(storage, ownerId, isCurrent);
    await deleteOnServer(password);
  } catch (error) {
    await frozen.resume();
    throw error;
  }
  // Server success is irreversible. Finish A's scoped cleanup even if another
  // account is now active; the controller separately guards session removal.
  try {
    await frozen.confirm();
    await frozen.cleanup(removePhoto);
    return null;
  } catch {
    return "Your account was deleted. Some data remains on this device because local cleanup failed. Clear this app's storage on this device to remove it.";
  }
}
