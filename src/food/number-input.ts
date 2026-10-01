export function parseNutritionAmount(input: string): number | null {
  const text = input.trim();
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return null;
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// Keep saved precision while presenting a decimal accepted by the form's parser.
export function nutritionAmountText(value: number): string {
  const text = String(value);
  if (!text.includes("e")) return text;
  const [coefficient, exponent] = text.split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = whole + fraction;
  const point = whole.length + Number(exponent);
  if (point <= 0) return `0.${"0".repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}
