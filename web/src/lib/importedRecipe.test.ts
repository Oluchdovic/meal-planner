import { describe, expect, it } from 'vitest';
import type { ImportedRecipe } from '../api/types';
import { toRecipeInput } from './importedRecipe';

function importedRecipe(overrides: Partial<ImportedRecipe> = {}): ImportedRecipe {
  return {
    name: 'Lasagnes maison',
    servings: 4,
    ingredients: [{ name: 'Steak haché', quantity: 500, unit: 'g' }],
    steps: [{ order: 1, description: 'Préparer les ingrédients' }],
    sourceUrl: 'https://exemple.fr/lasagnes',
    extraction: 'json-ld',
    warnings: [],
    ...overrides,
  };
}

describe('toRecipeInput', () => {
  it('mappe une recette complète', () => {
    expect(toRecipeInput(importedRecipe())).toEqual({
      title: 'Lasagnes maison',
      servings: 4,
      instructions: ['Préparer les ingrédients'],
      ingredients: [{ name: 'Steak haché', quantity: 500, unit: 'g' }],
    });
  });

  it('applique les valeurs de repli sur une quantité ou une unité manquante', () => {
    const input = toRecipeInput(
      importedRecipe({
        ingredients: [{ name: 'Sel' }, { name: 'Œufs', quantity: 3 }, { name: 'Lait', unit: 'ml' }],
      })
    );

    expect(input.ingredients).toEqual([
      { name: 'Sel', quantity: 1, unit: 'unite' },
      { name: 'Œufs', quantity: 3, unit: 'unite' },
      { name: 'Lait', quantity: 1, unit: 'ml' },
    ]);
  });

  it('remplace une quantité nulle ou négative par la valeur de repli', () => {
    const input = toRecipeInput(
      importedRecipe({ ingredients: [{ name: 'Beurre', quantity: 0, unit: 'g' }] })
    );
    expect(input.ingredients?.[0]?.quantity).toBe(1);
  });

  it('écarte les ingrédients sans nom', () => {
    const input = toRecipeInput(
      importedRecipe({ ingredients: [{ name: '  ' }, { name: 'Farine', quantity: 200, unit: 'g' }] })
    );
    expect(input.ingredients).toHaveLength(1);
  });

  it('ordonne les étapes et écarte les descriptions vides', () => {
    const input = toRecipeInput(
      importedRecipe({
        steps: [
          { order: 3, description: 'Servir' },
          { order: 1, description: 'Mélanger' },
          { order: 2, description: '   ' },
        ],
      })
    );
    expect(input.instructions).toEqual(['Mélanger', 'Servir']);
  });

  it('nettoie les espaces du titre', () => {
    expect(toRecipeInput(importedRecipe({ name: '  Tarte aux pommes ' })).title).toBe(
      'Tarte aux pommes'
    );
  });
});
