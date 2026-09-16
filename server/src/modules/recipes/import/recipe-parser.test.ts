import { describe, expect, it } from 'vitest';
import {
  normalizeRecipe,
  parseIngredientLine,
  parseServings,
  parseSteps,
  readLeadingQuantity,
} from './recipe-parser.js';
import type { RawRecipe } from './types.js';

describe('parseServings', () => {
  it.each([
    [4, 4],
    ['4', 4],
    ['4 personnes', 4],
    ['Pour 6 parts', 6],
    ['4 à 6 personnes', 4],
    [['8 servings', '8'], 8],
    [{ '@value': 2 }, 2],
    ['2,5', 2.5],
  ])('interprète %j comme %s portions', (raw, expected) => {
    expect(parseServings(raw)).toBe(expected);
  });

  it.each([[undefined], [null], ['plusieurs'], [0], [-3], ['']])(
    'retourne null pour %j',
    (raw) => {
      expect(parseServings(raw)).toBeNull();
    }
  );

  it('plafonne les valeurs aberrantes', () => {
    expect(parseServings(100000)).toBe(100);
  });
});

describe('readLeadingQuantity', () => {
  it.each([
    ['500 g', 500],
    ['1,5 l', 1.5],
    ['1.5 l', 1.5],
    ['1/2 citron', 0.5],
    ['1 1/2 tasse', 1.5],
    ['½ botte', 0.5],
    ['1½ kg', 1.5],
    ['deux oignons', 2],
    ['Une pincée', 1],
  ])('lit la quantité de « %s »', (line, expected) => {
    expect(readLeadingQuantity(line)?.value).toBeCloseTo(expected, 5);
  });

  it('retourne null sans quantité en tête', () => {
    expect(readLeadingQuantity('Sel et poivre')).toBeNull();
  });
});

describe('parseIngredientLine', () => {
  it('sépare quantité, unité et nom', () => {
    expect(parseIngredientLine('500 g de steak haché')).toEqual({
      name: 'steak haché',
      quantity: 500,
      unit: 'g',
    });
  });

  it.each([
    ['200g de farine', { name: 'farine', quantity: 200, unit: 'g' }],
    ['1 gousse d’ail', { name: 'ail', quantity: 1, unit: 'gousse' }],
    ['2 cuillères à soupe d’huile d’olive', { name: 'huile d’olive', quantity: 2, unit: 'cas' }],
    ['1 c. à café de sel', { name: 'sel', quantity: 1, unit: 'cac' }],
    ['3 tranches de jambon', { name: 'jambon', quantity: 3, unit: 'tranche' }],
    ['1 sachet de levure', { name: 'levure', quantity: 1, unit: 'sachet' }],
    ['1 botte de persil', { name: 'persil', quantity: 1, unit: 'botte' }],
    ['une pincée de sel', { name: 'sel', quantity: 1, unit: 'pincee' }],
  ])('parse « %s »', (line, expected) => {
    expect(parseIngredientLine(line)).toEqual(expected);
  });

  it('convertit les unités absentes de l’énumération vers une unité supportée', () => {
    expect(parseIngredientLine('20 cl de crème')).toEqual({
      name: 'crème',
      quantity: 200,
      unit: 'ml',
    });
    expect(parseIngredientLine('500 mg de safran')).toEqual({
      name: 'safran',
      quantity: 0.5,
      unit: 'g',
    });
  });

  it('retient la borne basse d’un intervalle', () => {
    expect(parseIngredientLine('2 à 3 gousses d’ail')).toEqual({
      name: 'ail',
      quantity: 2,
      unit: 'gousse',
    });
  });

  it('omet l’unité quand elle n’a pas d’équivalent', () => {
    expect(parseIngredientLine('3 œufs')).toEqual({ name: 'œufs', quantity: 3 });
    expect(parseIngredientLine('1 verre de lait')).toEqual({ name: 'verre de lait', quantity: 1 });
  });

  it('omet la quantité quand la ligne n’en contient pas', () => {
    expect(parseIngredientLine('Sel et poivre du moulin')).toEqual({
      name: 'Sel et poivre du moulin',
    });
  });

  it('ne confond pas un adjectif avec une unité', () => {
    expect(parseIngredientLine('3 gros oignons')).toEqual({ name: 'gros oignons', quantity: 3 });
  });

  it('nettoie les puces, le HTML et les espaces', () => {
    expect(parseIngredientLine('  • <span>250 g</span> de beurre  ')).toEqual({
      name: 'beurre',
      quantity: 250,
      unit: 'g',
    });
  });

  it('ignore les intertitres et les lignes vides', () => {
    expect(parseIngredientLine('Pour la garniture :')).toBeNull();
    expect(parseIngredientLine('   ')).toBeNull();
    expect(parseIngredientLine('---')).toBeNull();
  });
});

describe('parseSteps', () => {
  it('numérote les étapes à partir de 1', () => {
    expect(parseSteps(['Préparer les ingrédients', 'Enfourner 30 minutes'])).toEqual([
      { order: 1, description: 'Préparer les ingrédients' },
      { order: 2, description: 'Enfourner 30 minutes' },
    ]);
  });

  it('découpe un bloc unique sur les sauts de ligne', () => {
    expect(parseSteps(['<p>Mélanger la farine</p><p>Ajouter les œufs</p>'])).toEqual([
      { order: 1, description: 'Mélanger la farine' },
      { order: 2, description: 'Ajouter les œufs' },
    ]);
  });

  it('retire la numérotation déjà présente', () => {
    expect(parseSteps(['Étape 1 : Battre les œufs', '2. Ajouter le lait'])).toEqual([
      { order: 1, description: 'Battre les œufs' },
      { order: 2, description: 'Ajouter le lait' },
    ]);
  });

  it('supprime les fragments vides et les doublons consécutifs', () => {
    expect(parseSteps(['Mélanger', '', 'Mélanger', 'Cuire'])).toEqual([
      { order: 1, description: 'Mélanger' },
      { order: 2, description: 'Cuire' },
    ]);
  });
});

describe('normalizeRecipe', () => {
  const baseRaw: RawRecipe = {
    name: 'Lasagnes maison',
    servingsRaw: '4 personnes',
    ingredientLines: ['500 g de steak haché'],
    instructionBlocks: ['Préparer les ingrédients'],
    extraction: 'json-ld',
  };

  it('produit un DTO complet sans avertissement', () => {
    expect(normalizeRecipe(baseRaw, 'https://exemple.fr/lasagnes')).toEqual({
      name: 'Lasagnes maison',
      servings: 4,
      ingredients: [{ name: 'steak haché', quantity: 500, unit: 'g' }],
      steps: [{ order: 1, description: 'Préparer les ingrédients' }],
      sourceUrl: 'https://exemple.fr/lasagnes',
      extraction: 'json-ld',
      warnings: [],
    });
  });

  it('applique 4 portions par défaut et prévient l’utilisateur', () => {
    const recipe = normalizeRecipe({ ...baseRaw, servingsRaw: undefined }, 'https://exemple.fr');
    expect(recipe.servings).toBe(4);
    expect(recipe.warnings).toContainEqual(expect.stringContaining('Nombre de personnes'));
  });

  it('signale les données partielles', () => {
    const recipe = normalizeRecipe(
      { ...baseRaw, ingredientLines: ['Sel'], instructionBlocks: [] },
      'https://exemple.fr'
    );
    expect(recipe.warnings).toEqual([
      expect.stringContaining('1 ingrédient(s) sans quantité'),
      expect.stringContaining('1 ingrédient(s) dont l’unité'),
      expect.stringContaining('Aucune étape'),
    ]);
  });

  it('signale une extraction heuristique', () => {
    const recipe = normalizeRecipe({ ...baseRaw, extraction: 'heuristic' }, 'https://exemple.fr');
    expect(recipe.warnings[0]).toContain('Aucune donnée structurée');
  });

  it('tronque un titre trop long', () => {
    const recipe = normalizeRecipe({ ...baseRaw, name: 'a'.repeat(400) }, 'https://exemple.fr');
    expect(recipe.name).toHaveLength(160);
  });
});
