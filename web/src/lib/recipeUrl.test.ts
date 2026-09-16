import { describe, expect, it } from 'vitest';
import { isValidRecipeUrl, normalizeRecipeUrl } from './recipeUrl';

describe('normalizeRecipeUrl', () => {
  it('conserve une URL déjà complète', () => {
    expect(normalizeRecipeUrl('https://www.exemple.fr/recette/lasagnes')).toBe(
      'https://www.exemple.fr/recette/lasagnes'
    );
  });

  it('ajoute le schéma https quand il manque', () => {
    expect(normalizeRecipeUrl('www.exemple.fr/recette')).toBe('https://www.exemple.fr/recette');
  });

  it('ignore les espaces autour de la saisie', () => {
    expect(normalizeRecipeUrl('  https://exemple.fr/r  ')).toBe('https://exemple.fr/r');
  });

  it('accepte http', () => {
    expect(normalizeRecipeUrl('http://exemple.fr/r')).toBe('http://exemple.fr/r');
  });

  it.each(['', '   ', 'pas une url', 'exemple', 'http://', 'https://.fr'])(
    'refuse « %s »',
    (value) => {
      expect(normalizeRecipeUrl(value)).toBeNull();
    }
  );

  it.each(['ftp://exemple.fr/r', 'file:///etc/passwd', 'javascript:alert(1)'])(
    'refuse le protocole de %s',
    (value) => {
      expect(normalizeRecipeUrl(value)).toBeNull();
    }
  );

  it('refuse un hôte sans point (machine locale)', () => {
    expect(normalizeRecipeUrl('http://localhost:3000/api')).toBeNull();
    expect(normalizeRecipeUrl('http://intranet/recette')).toBeNull();
  });
});

describe('isValidRecipeUrl', () => {
  it('reflète le résultat de la normalisation', () => {
    expect(isValidRecipeUrl('https://exemple.fr/r')).toBe(true);
    expect(isValidRecipeUrl('nawak')).toBe(false);
  });
});
