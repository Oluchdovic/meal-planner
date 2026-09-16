import type { ImportedRecipe, RecipeIngredientInput, RecipeInput, Unit } from '../api/types';

/**
 * Conversion d'une recette importée en charge utile `POST /api/recipes`.
 *
 * L'extraction distante peut laisser une quantité ou une unité indéterminée
 * (unité absente de l'énumération fermée, ligne sans nombre) : on applique ici
 * les valeurs de repli qui permettent d'enregistrer la recette quand même.
 * L'utilisateur corrige ensuite depuis le formulaire de recette.
 */

const FALLBACK_QUANTITY = 1;
const FALLBACK_UNIT: Unit = 'unite';

export function toRecipeInput(imported: ImportedRecipe): RecipeInput {
  const ingredients: RecipeIngredientInput[] = [];

  for (const ingredient of imported.ingredients) {
    const name = ingredient.name.trim();
    if (!name) continue;

    const quantity = ingredient.quantity;
    ingredients.push({
      name,
      quantity: quantity !== undefined && quantity > 0 ? quantity : FALLBACK_QUANTITY,
      unit: ingredient.unit ?? FALLBACK_UNIT,
    });
  }

  const instructions = [...imported.steps]
    .sort((a, b) => a.order - b.order)
    .map((step) => step.description.trim())
    .filter(Boolean);

  return {
    title: imported.name.trim(),
    servings: imported.servings,
    instructions,
    ingredients,
  };
}
