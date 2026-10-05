import {
  isSafeMediaId, parseProfileMedia, validatePhotoDetails, validatePhotoSource,
  type MediaFiles, type PhotoSource, type ProfileMediaDocument, type StoredPhoto,
} from "./media-model.ts";

export const profileMediaStorageKey = "kinevault-track.profile-media.v1";
export type ProfileMediaSnapshot = Readonly<{
  state: { kind: "loading" } | { kind: "error" } | { kind: "ready"; document: ProfileMediaDocument };
  saving: boolean;
  error: string | null;
}>;
export type ProfileMediaStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
export type AddPhotoInput = { source: PhotoSource; date: string; note: string };
export type UpdatePhotoInput = { id: string; date: string; note: string; source?: PhotoSource };

type Mutation = {
  source?: PhotoSource;
  imageId?: string;
  obsolete?: StoredPhoto | null;
  document(image?: StoredPhoto): ProfileMediaDocument;
};

export function createProfileMediaPersistence({ storage, files, createId }: {
  storage: ProfileMediaStorage; files: MediaFiles; createId: () => string;
}) {
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
  async function cleanup(image: StoredPhoto | null | undefined) {
    if (!image) return;
    try { await files.removePhoto(image); } catch { /* Metadata remains authoritative. */ }
  }
  function allocateId(document: ProfileMediaDocument, reserved: string[] = []) {
    const id = createId();
    if (!isSafeMediaId(id) || reserved.includes(id) || document.avatar?.id === id
      || document.photos.some(photo => photo.id === id || photo.image.id === id)) {
      throw new Error("Invalid or reused media identity");
    }
    return id;
  }
  function copySource(source: PhotoSource) {
    validatePhotoSource(source);
    return { ...source };
  }
  async function mutate(prepare: (document: ProfileMediaDocument) => Mutation): Promise<boolean> {
    if (!active || pending || snapshot.state.kind !== "ready") return false;
    let mutation: Mutation;
    try { mutation = prepare(parseProfileMedia(JSON.stringify(snapshot.state.document))); }
    catch {
      publish({ error: "Check the photo, date, and note and try again." });
      return false;
    }
    const ticket = { lifecycle };
    pending = ticket;
    ++readGeneration;
    publish({ saving: true, error: null });
    let imported: StoredPhoto | undefined;
    let committed = false;
    try {
      if (!current(ticket)) return false;
      let image: StoredPhoto | undefined;
      if (mutation.source && mutation.imageId) {
        image = await files.importPhoto(mutation.source, mutation.imageId);
        // Cleanup always targets our allocated ID, never an adapter-returned path/ID.
        imported = { id: mutation.imageId, width: mutation.source.width, height: mutation.source.height };
        if (image.id !== mutation.imageId) throw new Error("Unexpected imported photo identity");
      }
      const document = parseProfileMedia(JSON.stringify(mutation.document(image)));
      if (!current(ticket)) return false;
      await storage.setItem(profileMediaStorageKey, JSON.stringify(document));
      committed = true;
      if (current(ticket)) publish({ state: { kind: "ready", document } });
      await cleanup(mutation.obsolete);
      return true;
    } catch {
      if (current(ticket)) publish({ error: "Couldn't save your photo changes. Try again." });
      return false;
    } finally {
      // Lifecycle cancellation after setItem resolves must never remove durable media.
      if (!committed) await cleanup(imported);
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
    stop() { active = false; ++lifecycle; ++readGeneration; },
    retryLoad() { void load(); },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    saveAvatar(source: PhotoSource | null) {
      return mutate(document => ({
        source: source === null ? undefined : copySource(source),
        imageId: source === null ? undefined : allocateId(document),
        obsolete: document.avatar,
        document: image => ({ ...document, avatar: image ?? null }),
      }));
    },
    addPhoto({ source, date, note }: AddPhotoInput) {
      return mutate(document => {
        validatePhotoDetails(date, note);
        const selected = copySource(source);
        const id = allocateId(document);
        const imageId = allocateId(document, [id]);
        return { source: selected, imageId, document: image => {
          if (!image) throw new Error("Missing imported photo");
          return { ...document, photos: [...document.photos, { id, date, note, image }] };
        } };
      });
    },
    updatePhoto({ id, date, note, source }: UpdatePhotoInput) {
      return mutate(document => {
        validatePhotoDetails(date, note);
        const previous = document.photos.find(photo => photo.id === id);
        if (!previous) throw new Error("Photo no longer exists");
        const selected = source === undefined ? undefined : copySource(source);
        return {
          source: selected,
          imageId: selected ? allocateId(document) : undefined,
          obsolete: selected ? previous.image : undefined,
          document: image => ({ ...document, photos: document.photos.map(photo => photo.id === id
            ? { ...photo, date, note, image: image ?? photo.image } : photo) }),
        };
      });
    },
    removePhoto(id: string) {
      return mutate(document => {
        const previous = document.photos.find(photo => photo.id === id);
        if (!previous) throw new Error("Photo no longer exists");
        return { obsolete: previous.image, document: () => ({ ...document, photos: document.photos.filter(photo => photo.id !== id) }) };
      });
    },
  };
}
