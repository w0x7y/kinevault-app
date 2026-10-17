// Demo clips and the catalog list come from the same Supabase project as accounts.
export type DemoCatalogConfig = { url: string; key: string };
export const demoBucket = "exercise-demos";
/** Publishing flattens every clip onto this color (scripts/publish-catalog.mjs), so demo frames use it in both themes. */
export const demoBackdrop = "#232f3b";

/** The project that serves demos, or null when this build isn't configured for one. */
export function demoCatalogConfigFrom(
  url: string | undefined,
  key: string | undefined,
): DemoCatalogConfig | null {
  const base = url?.trim();
  const apiKey = key?.trim();
  if (!base || !apiKey) return null;
  try {
    const parsed = new URL(base);
    const local =
      parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !local) return null;
    return { url: parsed.origin, key: apiKey };
  } catch {
    return null;
  }
}

// Expo inlines EXPO_PUBLIC_* only for direct `process.env.NAME` references.
export const demoCatalogConfig = demoCatalogConfigFrom(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export function demoObjectUrl(config: DemoCatalogConfig, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${config.url}/storage/v1/object/public/${demoBucket}/${encoded}`;
}
