// Canonicalize keyboard typography only. Keep letters, case and meaningful
// punctuation so brand filters and identity-sensitive matching retain their rules.
export function canonicalFoodSearchQuery(input: string): string {
  return input.normalize("NFC")
    .replace(/[’‘‛ʼ＇]/gu, "'")
    .replace(/[\p{White_Space}\uFEFF]+/gu, " ").trim();
}
