export const UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'unite',
  'cas',
  'cac',
  'pincee',
  'tranche',
  'botte',
  'gousse',
  'sachet',
] as const;

export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  unite: 'unité(s)',
  cas: 'c. à soupe',
  cac: 'c. à café',
  pincee: 'pincée(s)',
  tranche: 'tranche(s)',
  botte: 'botte(s)',
  gousse: 'gousse(s)',
  sachet: 'sachet(s)',
};

export interface RecipeIngredient {
  id: number;
  name: string;
  quantity: number;
  unit: Unit;
  sortOrder: number;
}

export interface Recipe {
  id: number;
  userId: number;
  title: string;
  servings: number;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  instructions: string[];
  photoPath: string | null;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredient[];
  tags: Tag[];
}

export interface RecipeIngredientInput {
  name: string;
  quantity: number;
  unit: Unit;
}

export interface RecipeInput {
  title: string;
  servings: number;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  instructions?: string[];
  ingredients?: RecipeIngredientInput[];
  tagIds?: number[];
}

export interface Tag {
  id: number;
  name: string;
}

/** Stratégie d'extraction utilisée par l'import depuis une URL. */
export type ImportExtractionStrategy = 'json-ld' | 'microdata' | 'heuristic';

export interface ImportedIngredient {
  name: string;
  /** Absent si aucune quantité n'a pu être lue sur la page d'origine. */
  quantity?: number;
  /** Absent si l'unité d'origine n'a pas d'équivalent dans `UNITS`. */
  unit?: Unit;
}

export interface ImportedRecipeStep {
  order: number;
  description: string;
}

/** Réponse de `POST /api/recipes/import` : recette extraite, non encore enregistrée. */
export interface ImportedRecipe {
  name: string;
  servings: number;
  ingredients: ImportedIngredient[];
  steps: ImportedRecipeStep[];
  sourceUrl: string;
  extraction: ImportExtractionStrategy;
  warnings: string[];
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Encas',
};

export interface PlanSlot {
  id: number;
  planId: number;
  date: string;
  mealType: MealType;
  recipeId: number | null;
  recipeTitle: string | null;
  servingsOverride: number | null;
  constraintTags: number[] | null;
}

export interface MealPlan {
  id: number;
  userId: number;
  name: string | null;
  startDate: string;
  endDate: string;
  createdAt: string;
  slots: PlanSlot[];
}

export interface MealPlanInput {
  name?: string | null;
  startDate: string;
  endDate: string;
}

export interface PlanSlotInput {
  recipeId?: number | null;
  servingsOverride?: number | null;
}

export interface ShoppingListItem {
  name: string;
  unit: Unit;
  quantity: number;
}
