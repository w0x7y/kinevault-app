import { mediaFiles } from "../profile/media-files";
import type { StoredPhoto } from "../profile/media-model";

export async function readExportPhoto(photo: StoredPhoto): Promise<string> {
  const uri = await mediaFiles.resolvePhoto(photo);
  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("Photo unavailable");
    const blob = await response.blob();
    if (!blob.size || blob.type !== "image/jpeg") throw new Error("Photo unavailable");
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Photo unavailable"));
      reader.onload = () =>
        typeof reader.result === "string" && reader.result.startsWith("data:image/jpeg;base64,")
          ? resolve(reader.result.slice("data:image/jpeg;base64,".length))
          : reject(new Error("Photo unavailable"));
      reader.readAsDataURL(blob);
    });
  } finally {
    mediaFiles.releaseUri(uri);
  }
}

export async function saveAccountExport(contents: string, isCurrent: () => boolean): Promise<void> {
  if (!isCurrent()) throw new Error("The account changed. Start again.");
  const uri = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  try {
    const link = document.createElement("a");
    link.href = uri;
    link.download = `kinevault-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser time to consume the downloaded blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(uri), 1000);
  }
}
