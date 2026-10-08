import {
  MediaIdentityCollisionError,
  isSafeMediaId,
  isPhotoDimension,
  parseProfileMedia,
  type MediaFiles,
  type PhotoSource,
  type ProfileMediaDocument,
  type StoredPhoto,
} from "./media-model.ts";

export const profileMediaStorageKey = "kinevault-track.profile-media.v1";

/** Local-only ownership evidence, recorded before importing or detaching a file. */
export const profileMediaOwnershipKey = "kinevault-track.profile-media.v1.ownership.v1";
export function parseMediaOwnership(raw: string | null): StoredPhoto[] {
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("images" in value) ||
    !Array.isArray(value.images)
  )
    throw new Error("Invalid photo ownership inventory");
  const ids = new Set<string>();
  return value.images.map((image: unknown) => {
    if (
      !image ||
      typeof image !== "object" ||
      !("id" in image) ||
      !isSafeMediaId(image.id) ||
      ids.has(image.id) ||
      !("width" in image) ||
      !isPhotoDimension(image.width) ||
      !("height" in image) ||
      !isPhotoDimension(image.height)
    )
      throw new Error("Invalid photo ownership inventory");
    ids.add(image.id);
    return { id: image.id, width: image.width, height: image.height };
  });
}
export function encodeMediaOwnership(images: Iterable<StoredPhoto>): string {
  return JSON.stringify({ version: 1, images: [...images] });
}

type InventoryStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
};
type Inventory = { key: string; images: StoredPhoto[] };
const mediaKeys = [profileMediaStorageKey, profileMediaOwnershipKey];
function documentImages(document: ProfileMediaDocument): StoredPhoto[] {
  return [
    ...(document.avatar ? [document.avatar] : []),
    ...document.photos.map((photo) => photo.image),
  ];
}
async function inventories(
  local: Pick<InventoryStorage, "getItem">,
  keys: readonly string[],
): Promise<Inventory[]> {
  const result: Inventory[] = [];
  for (const key of keys) {
    if (!mediaKeys.some((root) => key === root || key.endsWith(`.${root}`))) continue;
    const raw = await local.getItem(key);
    result.push({
      key,
      images: key.endsWith(profileMediaOwnershipKey)
        ? parseMediaOwnership(raw)
        : documentImages(parseProfileMedia(raw)),
    });
  }
  return result;
}

/** Account supplies owner keys and its local gate; this module interprets all media evidence. */
export function createMediaOwnershipInventory({
  local,
  ownerKey,
  transact,
}: {
  local: InventoryStorage;
  ownerKey(key: string): Promise<string>;
  transact<T>(run: () => Promise<T>): Promise<T>;
}) {
  async function forget(key: string, id: string) {
    const remaining = parseMediaOwnership(await local.getItem(key)).filter(
      (image) => image.id !== id,
    );
    await local.setItem(key, encodeMediaOwnership(remaining));
  }
  return {
    reserve(document: ProfileMediaDocument, allocated?: StoredPhoto) {
      return transact(async () => {
        if (allocated) {
          const known = await inventories(local, await local.getAllKeys());
          if (
            known.some((inventory) => inventory.images.some((image) => image.id === allocated.id))
          )
            throw new Error("Photo identity already belongs to an owner");
        }
        const key = await ownerKey(profileMediaOwnershipKey);
        const owned = new Map(
          parseMediaOwnership(await local.getItem(key)).map((image) => [image.id, image]),
        );
        for (const image of documentImages(document)) owned.set(image.id, image);
        if (allocated) owned.set(allocated.id, allocated);
        await local.setItem(key, encodeMediaOwnership(owned.values()));
      });
    },
    releaseCollision(id: string) {
      // Exclusive creation rejected: release our reservation without touching the existing asset.
      return transact(async () => forget(await ownerKey(profileMediaOwnershipKey), id));
    },
    retire(image: StoredPhoto, removePhoto: MediaFiles["removePhoto"]) {
      return transact(async () => {
        const ledger = await ownerKey(profileMediaOwnershipKey);
        const known = await inventories(local, await local.getAllKeys());
        // Other ledgers and every published metadata reference protect the physical file.
        const protectedImage = known.some(
          (inventory) =>
            inventory.key !== ledger && inventory.images.some((other) => other.id === image.id),
        );
        if (!protectedImage) await removePhoto(image);
        await forget(ledger, image.id);
      });
    },
  };
}
export type MediaOwnershipInventory = ReturnType<typeof createMediaOwnershipInventory>;

/** Called under Account storage's deletion gate; failures retain the inventories for retry. */
export async function removeOwnedMedia({
  local,
  keys,
  targets,
  removePhoto,
}: {
  local: Pick<InventoryStorage, "getItem">;
  keys: readonly string[];
  targets: ReadonlySet<string>;
  removePhoto: MediaFiles["removePhoto"];
}) {
  const photos = new Map<string, StoredPhoto>();
  const protectedIds = new Set<string>();
  for (const inventory of await inventories(local, keys)) {
    for (const image of inventory.images) {
      if (targets.has(inventory.key)) photos.set(image.id, image);
      else protectedIds.add(image.id);
    }
  }
  for (const image of photos.values()) {
    if (!protectedIds.has(image.id)) await removePhoto(image);
  }
}

export type MediaOwnershipChange = {
  before: ProfileMediaDocument;
  source?: PhotoSource;
  imageId?: string;
  obsolete?: StoredPhoto | null;
  document(image?: StoredPhoto): ProfileMediaDocument;
  isCurrent(): boolean;
  commit(document: ProfileMediaDocument): Promise<void>;
};

/** Owns reservation, import and retirement, including interrupted/partial imports. */
export function createProfileMediaOwnership({
  inventory,
  files,
  createId,
}: {
  inventory: MediaOwnershipInventory;
  files: MediaFiles;
  createId: () => string;
}) {
  async function retire(image: StoredPhoto | undefined | null) {
    if (!image) return;
    try {
      await inventory.retire(image, files.removePhoto);
    } catch {
      // The ledger survives failed physical removal or writes for account-deletion recovery.
    }
  }
  return {
    allocateId(document: ProfileMediaDocument, reserved: string[] = []) {
      const id = createId();
      if (
        !isSafeMediaId(id) ||
        reserved.includes(id) ||
        document.avatar?.id === id ||
        document.photos.some((photo) => photo.id === id || photo.image.id === id)
      )
        throw new Error("Invalid or reused media identity");
      return id;
    },
    async change(change: MediaOwnershipChange): Promise<boolean> {
      let imported: StoredPhoto | undefined;
      let committed = false;
      try {
        if (!change.isCurrent()) return false;
        const allocated =
          change.source && change.imageId
            ? { id: change.imageId, width: change.source.width, height: change.source.height }
            : undefined;
        if (allocated) await files.assertAvailable?.(allocated.id);
        if (!change.isCurrent()) return false;
        // Durable ownership precedes imports which can leave files behind even when they reject.
        await inventory.reserve(change.before, allocated);
        if (!change.isCurrent()) return false;
        let image: StoredPhoto | undefined;
        if (change.source && allocated) {
          imported = allocated;
          try {
            image = await files.importPhoto(change.source, allocated.id);
          } catch (error) {
            if (error instanceof MediaIdentityCollisionError) {
              imported = undefined;
              await inventory.releaseCollision(allocated.id);
            }
            throw error;
          }
          if (image.id !== allocated.id) throw new Error("Unexpected imported photo identity");
        }
        const document = parseProfileMedia(JSON.stringify(change.document(image)));
        if (!change.isCurrent()) return false;
        await change.commit(document);
        committed = true;
        await retire(change.obsolete);
        return true;
      } finally {
        if (!committed) await retire(imported);
      }
    },
  };
}
