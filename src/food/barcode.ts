export const supportedProductBarcodeTypes = ["ean13", "ean8", "upc_a", "upc_e", "itf14"] as const;

function hasValidCheckDigit(code: string): boolean {
  let sum = 0;
  for (let index = code.length - 2, weight = 3; index >= 0; index--, weight = weight === 3 ? 1 : 3) {
    sum += Number(code[index]) * weight;
  }
  return (10 - sum % 10) % 10 === Number(code.at(-1));
}

function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const system = code[0];
  const digits = code.slice(1, 7);
  const last = digits[5];
  // UPC-E's final payload digit determines the zero-suppression pattern.
  // Verified against ZXing UPCEReader.convertUPCEtoUPCA.
  let payload: string;
  if (last === "0" || last === "1" || last === "2") {
    payload = digits.slice(0, 2) + last + "0000" + digits.slice(2, 5);
  } else if (last === "3") {
    payload = digits.slice(0, 3) + "00000" + digits.slice(3, 5);
  } else if (last === "4") {
    payload = digits.slice(0, 4) + "00000" + digits[4];
  } else {
    payload = digits.slice(0, 5) + "0000" + last;
  }
  return system + payload + code[7];
}

/** Scanner format disambiguates UPC-E from EAN-8. Manual input uses full GTINs. */
export function normalizeProductBarcode(data: string, format?: string): string | null {
  let code = data.trim();
  if (!/^\d+$/.test(code) || /^0+$/.test(code)) return null;
  if (format === "upc_e") {
    const expanded = expandUpcE(code);
    if (!expanded) return null;
    code = expanded;
  } else if (format !== undefined) {
    const lengths: Record<string, number> = { ean13: 13, ean8: 8, upc_a: 12, itf14: 14 };
    if (!Object.hasOwn(lengths, format) || code.length !== lengths[format]) return null;
  }
  if (![8, 12, 13, 14].includes(code.length) || !hasValidCheckDigit(code)) return null;
  return code;
}
