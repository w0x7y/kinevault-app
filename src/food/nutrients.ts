export const detailedNutrients = [
  { key: "saturatedFat", label: "Saturated fat", unit: "g", indented: true },
  { key: "transFat", label: "Trans fat", unit: "g", indented: true },
  { key: "fiber", label: "Fiber", unit: "g", indented: false },
  { key: "totalSugars", label: "Total sugars", unit: "g", indented: false },
  { key: "sodium", label: "Sodium", unit: "mg", indented: false },
  { key: "cholesterol", label: "Cholesterol", unit: "mg", indented: false },
  { key: "potassium", label: "Potassium", unit: "mg", indented: false },
  { key: "calcium", label: "Calcium", unit: "mg", indented: false },
  { key: "iron", label: "Iron", unit: "mg", indented: false },
  { key: "vitaminD", label: "Vitamins D", unit: "mcg", indented: false },
  { key: "caffeine", label: "Caffeine", unit: "mg", indented: false },
  { key: "alcohol", label: "Alcohol", unit: "g", indented: false },
] as const;
export type DetailedNutrientKey = (typeof detailedNutrients)[number]["key"];
export type DetailedNutrients = Record<DetailedNutrientKey, number | null>;
export const unknownNutrients: DetailedNutrients = {
  saturatedFat: null, transFat: null, fiber: null, totalSugars: null,
  sodium: null, cholesterol: null, potassium: null, calcium: null,
  iron: null, vitaminD: null, caffeine: null, alcohol: null,
};

export function scaleNutrients(nutrients: DetailedNutrients, factor: number): DetailedNutrients {
  const result = { ...unknownNutrients };
  for (const { key } of detailedNutrients) {
    const value = nutrients[key];
    result[key] = value === null ? null : value * factor;
  }
  return result;
}
