import type Database from 'better-sqlite3';
import type { MealPlan } from '../plans/types.js';

export interface ShoppingListItem {
  name: string;
  unit: string;
  quantity: number;
}

export function computeShoppingList(db: Database.Database, plan: MealPlan): ShoppingListItem[] {
  const aggregated = new Map<string, ShoppingListItem>();

  const ingredientsStmt = db.prepare(
    'SELECT name, quantity, unit FROM recipe_ingredients WHERE recipe_id = ?'
  );
  const servingsStmt = db.prepare('SELECT servings FROM recipes WHERE id = ?');

  for (const slot of plan.slots) {
    if (!slot.recipeId) continue;

    const recipe = servingsStmt.get(slot.recipeId) as { servings: number } | undefined;
    if (!recipe) continue;

    const scale = slot.servingsOverride != null ? slot.servingsOverride / recipe.servings : 1;

    const ingredients = ingredientsStmt.all(slot.recipeId) as {
      name: string;
      quantity: number;
      unit: string;
    }[];

    for (const ing of ingredients) {
      const normalizedName = ing.name.trim().toLowerCase();
      const key = `${normalizedName}::${ing.unit}`;
      const scaledQuantity = ing.quantity * scale;

      const existing = aggregated.get(key);
      if (existing) {
        existing.quantity += scaledQuantity;
      } else {
        aggregated.set(key, {
          name: ing.name.trim(),
          unit: ing.unit,
          quantity: scaledQuantity,
        });
      }
    }
  }

  return Array.from(aggregated.values())
    .map((item) => ({ ...item, quantity: Math.round(item.quantity * 1000) / 1000 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
