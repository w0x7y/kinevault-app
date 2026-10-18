import type { User } from "@supabase/supabase-js";
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

/** Accounts created with Google have no password, so they confirm deletion by signing in with Google again. */
export function deletionProof(user: User | null): "password" | "google" {
  const providers = user?.app_metadata.providers ?? [];
  return providers.includes("google") && !providers.includes("email") ? "google" : "password";
}

/** The delete-account function accepts this session's Google sign-in for 10 minutes. */
export function recentGoogleSignIn(accessToken: string | undefined, now = Date.now()): boolean {
  try {
    const part = accessToken!.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    const { amr } = JSON.parse(atob(part));
    return (
      Array.isArray(amr) &&
      amr.some(
        (entry) =>
          entry?.method === "oauth" &&
          typeof entry.timestamp === "number" &&
          now - entry.timestamp * 1000 <= 10 * 60 * 1000,
      )
    );
  } catch {
    return false;
  }
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
  /** Null when a recent Google sign-in confirms deletion instead. */
  password: string | null;
  confirmation: string;
  deleteOnServer: (password: string | null) => Promise<void>;
  removePhoto: (photo: StoredPhoto) => Promise<void>;
}): Promise<string | null> {
  checkOwner(storage, ownerId, isCurrent);
  if (confirmation !== "DELETE" || password === "" || (password?.length ?? 0) > 128)
    throw new Error(
      password === null
        ? "Type DELETE to confirm."
        : "Enter your password and type DELETE to confirm.",
    );
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
