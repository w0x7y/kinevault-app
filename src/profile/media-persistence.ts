import {
  parseProfileMedia,
  validatePhotoDetails,
  validatePhotoSource,
  type MediaFiles,
  type PhotoSource,
  type ProfileMediaDocument,
  type StoredPhoto,
} from "./media-model.ts";

import {
  createProfileMediaOwnership,
  profileMediaStorageKey,
  type MediaOwnershipInventory,
} from "./media-ownership.ts";

export { profileMediaStorageKey } from "./media-ownership.ts";
export type ProfileMediaSnapshot = Readonly<{
  state:
    { kind: "loading" } | { kind: "error" } | { kind: "ready"; document: ProfileMediaDocument };
  saving: boolean;
  error: string | null;
}>;
export type ProfileMediaStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  mediaOwnership: MediaOwnershipInventory;
  withMediaOperation<T>(run: () => Promise<T>): Promise<T>;
};
export type AddPhotoInput = { source: PhotoSource; date: string; note: string };
export type UpdatePhotoInput = { id: string; date: string; note: string; source?: PhotoSource };

type Mutation = {
  source?: PhotoSource;
  imageId?: string;
  obsolete?: StoredPhoto | null;
  document(image?: StoredPhoto): ProfileMediaDocument;
};

export function createProfileMediaPersistence({
  storage,
  files,
  createId,
}: {
  storage: ProfileMediaStorage;
  files: MediaFiles;
  createId: () => string;
}) {
  const ownership = createProfileMediaOwnership({
    inventory: storage.mediaOwnership,
    files,
    createId,
  });
  let snapshot: ProfileMediaSnapshot = { state: { kind: "loading" }, saving: false, error: null };
  const listeners = new Set<() => void>();
  let active = false;
  let lifecycle = 0;
  let readGeneration = 0;
  let pending: { lifecycle: number } | null = null;

  function publish(patch: Partial<ProfileMediaSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }
  async function load() {
    if (!active || pending) return;
    const generation = ++readGeneration;
    publish({ state: { kind: "loading" }, saving: false, error: null });
    if (!active || generation !== readGeneration) return;
    try {
      const document = parseProfileMedia(await storage.getItem(profileMediaStorageKey));
      if (active && generation === readGeneration) publish({ state: { kind: "ready", document } });
    } catch {
      if (active && generation === readGeneration) publish({ state: { kind: "error" } });
    }
  }
  function current(ticket: { lifecycle: number }) {
    return active && ticket.lifecycle === lifecycle;
  }
  function copySource(source: PhotoSource) {
    validatePhotoSource(source);
    return { ...source };
  }
  async function mutate(prepare: (document: ProfileMediaDocument) => Mutation): Promise<boolean> {
    if (!active || pending || snapshot.state.kind !== "ready") return false;
    let mutation: Mutation;
    try {
      mutation = prepare(parseProfileMedia(JSON.stringify(snapshot.state.document)));
    } catch {
      publish({ error: "Check the photo, date, and note and try again." });
      return false;
    }
    const ticket = { lifecycle };
    pending = ticket;
    ++readGeneration;
    publish({ saving: true, error: null });
    try {
      return await storage.withMediaOperation(async () => {
        if (!current(ticket) || snapshot.state.kind !== "ready") return false;
        return ownership.change({
          ...mutation,
          before: snapshot.state.document,
          isCurrent: () => current(ticket),
          async commit(document) {
            await storage.setItem(profileMediaStorageKey, JSON.stringify(document));
            if (current(ticket)) publish({ state: { kind: "ready", document } });
          },
        });
      });
    } catch {
      if (current(ticket)) publish({ error: "Couldn't save your photo changes. Try again." });
      return false;
    } finally {
      pending = null;
      if (active) {
        if (current(ticket)) publish({ saving: false });
        else void load();
      }
    }
  }

  return {
    start() {
      if (active) return;
      active = true;
      ++lifecycle;
      if (pending) publish({ state: { kind: "loading" } });
      else void load();
    },
    stop() {
      active = false;
      ++lifecycle;
      ++readGeneration;
    },
    retryLoad() {
      void load();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    saveAvatar(source: PhotoSource | null) {
      return mutate((document) => ({
        source: source === null ? undefined : copySource(source),
        imageId: source === null ? undefined : ownership.allocateId(document),
        obsolete: document.avatar,
        document: (image) => ({ ...document, avatar: image ?? null }),
      }));
    },
    addPhoto({ source, date, note }: AddPhotoInput) {
      return mutate((document) => {
        validatePhotoDetails(date, note);
        const selected = copySource(source);
        const id = ownership.allocateId(document);
        const imageId = ownership.allocateId(document, [id]);
        return {
          source: selected,
          imageId,
          document: (image) => {
            if (!image) throw new Error("Missing imported photo");
            return { ...document, photos: [...document.photos, { id, date, note, image }] };
          },
        };
      });
    },
    updatePhoto({ id, date, note, source }: UpdatePhotoInput) {
      return mutate((document) => {
        validatePhotoDetails(date, note);
        const previous = document.photos.find((photo) => photo.id === id);
        if (!previous) throw new Error("Photo no longer exists");
        const selected = source === undefined ? undefined : copySource(source);
        return {
          source: selected,
          imageId: selected ? ownership.allocateId(document) : undefined,
          obsolete: selected ? previous.image : undefined,
          document: (image) => ({
            ...document,
            photos: document.photos.map((photo) =>
              photo.id === id ? { ...photo, date, note, image: image ?? photo.image } : photo,
            ),
          }),
        };
      });
    },
    removePhoto(id: string) {
      return mutate((document) => {
        const previous = document.photos.find((photo) => photo.id === id);
        if (!previous) throw new Error("Photo no longer exists");
        return {
          obsolete: previous.image,
          document: () => ({
            ...document,
            photos: document.photos.filter((photo) => photo.id !== id),
          }),
        };
      });
    },
  };
}
