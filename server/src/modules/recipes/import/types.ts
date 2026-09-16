import type { Unit } from '../../../shared/units.js';

/** Stratégie ayant effectivement produit la recette (utile au diagnostic côté client). */
export type ExtractionStrategy = 'json-ld' | 'microdata' | 'heuristic';

/** Corps accepté par `POST /api/recipes/import`. */
export interface ImportRecipeRequest {
  url: string;
}

export interface ImportedIngredientDto {
  name: string;
  /** Absent lorsqu'aucune quantité n'a pu être lue sur la ligne d'origine. */
  quantity?: number;
  /** Absent lorsque l'unité d'origine n'a pas d'équivalent dans l'énumération fermée. */
  unit?: Unit;
}

export interface ImportedRecipeStepDto {
  /** 1-indexé, contigu. */
  order: number;
  description: string;
}

export interface ImportedRecipeDto {
  name: string;
  servings: number;
  ingredients: ImportedIngredientDto[];
  steps: ImportedRecipeStepDto[];
  /** URL finale réellement lue (après redirections). */
  sourceUrl: string;
  extraction: ExtractionStrategy;
  /** Messages en français décrivant les données manquantes ou approximées. */
  warnings: string[];
}

/**
 * Sortie brute des extracteurs, avant normalisation.
 * Les champs restent volontairement non typés / non nettoyés : chaque extracteur
 * remonte ce qu'il trouve, `recipe-parser` se charge de l'interpréter.
 */
export interface RawRecipe {
  name?: string;
  /** `recipeYield` Schema.org : nombre, chaîne ("4 personnes") ou tableau. */
  servingsRaw?: unknown;
  ingredientLines: string[];
  instructionBlocks: string[];
  extraction: ExtractionStrategy;
}
