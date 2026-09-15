export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

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
  constraintTags?: number[] | null;
}
