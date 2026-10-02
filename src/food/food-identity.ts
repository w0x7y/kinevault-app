export type FoodIdentity = { fdcId: number; customId?: never } | { customId: string; fdcId?: never };

export const foodKey = (food: FoodIdentity) => food.customId === undefined ? `usda:${food.fdcId}` : `custom:${food.customId}`;
