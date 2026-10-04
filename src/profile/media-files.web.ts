import {
  fitPhotoDimensions, isSafeMediaId, validatePhotoSource,
  type MediaFiles, type PhotoSource,
} from "./media-model.ts";

const databaseName = "kinevault-track.profile-media-files.v1";
const storeName = "photos";

function requireStorage() {
  if (typeof window === "undefined" || !window.indexedDB) throw new Error("Local photo storage is unavailable");
}
function validateId(id: string) {
  if (!isSafeMediaId(id)) throw new Error("Invalid photo identity");
}
async function openDatabase(): Promise<IDBDatabase> {
  requireStorage();
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: "id" });
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error("Local photo storage is unavailable"));
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Local photo storage is unavailable. Close other app tabs and retry."));
    };
  });
}
async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      let result: T;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error ?? new Error("Local photo storage transaction failed"));
      transaction.onerror = () => { /* Abort is the terminal failure signal. */ };
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => { result = request.result; };
    });
  } finally { database.close(); }
}
async function decodePhoto(source: PhotoSource): Promise<{ image: HTMLImageElement; release: () => void }> {
  if (!source.file && !/^(blob:|data:image\/)/.test(source.uri)) {
    throw new Error("Select a local image file");
  }
  const ownedUri = source.file ? URL.createObjectURL(source.file) : null;
  const image = new window.Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This photo could not be read"));
      image.src = ownedUri ?? source.uri;
    });
    return { image, release: () => { if (ownedUri) URL.revokeObjectURL(ownedUri); } };
  } catch (error) {
    if (ownedUri) URL.revokeObjectURL(ownedUri);
    throw error;
  }
}
async function resize(image: HTMLImageElement, maximum: number, quality: number) {
  const dimensions = fitPhotoDimensions(image.naturalWidth, image.naturalHeight, maximum);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value && value.type === "image/jpeg"
      ? resolve(value) : reject(new Error("This photo could not be processed")), "image/jpeg", quality);
  });
  return { blob, ...dimensions };
}

export function createMediaFiles(): MediaFiles {
  // No browser globals are read until a command runs, including during SSR.
  const uris = new Set<string>();
  return {
    async importPhoto(source, id) {
      requireStorage(); validateId(id); validatePhotoSource(source);
      const decoded = await decodePhoto(source);
      try {
        const original = await resize(decoded.image, 1600, 0.85);
        const thumbnail = await resize(decoded.image, 320, 0.75);
        // add rejects existing identities. Both versions commit atomically.
        await transact("readwrite", store => store.add({ id, original: original.blob, thumbnail: thumbnail.blob }));
        return { id, width: original.width, height: original.height };
      } finally { decoded.release(); }
    },
    async resolvePhoto(image, thumbnail = false) {
      validateId(image.id);
      const value: unknown = await transact("readonly", store => store.get(image.id));
      if (!value || typeof value !== "object") throw new Error("Photo unavailable");
      const blob = (value as Record<string, unknown>)[thumbnail ? "thumbnail" : "original"];
      if (!(blob instanceof Blob) || !blob.size || blob.type !== "image/jpeg") throw new Error("Photo unavailable");
      const uri = URL.createObjectURL(blob);
      uris.add(uri);
      return uri;
    },
    async removePhoto(image) {
      validateId(image.id);
      await transact("readwrite", store => store.delete(image.id));
    },
    releaseUri(uri) {
      if (uris.delete(uri)) URL.revokeObjectURL(uri);
    },
  };
}
export const mediaFiles = createMediaFiles();
