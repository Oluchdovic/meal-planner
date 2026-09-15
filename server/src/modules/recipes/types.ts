import type { Unit } from '../../shared/units.js';

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
  tags: { id: number; name: string }[];
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
