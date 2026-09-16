import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api/client';
import type { ImportedRecipe, Recipe } from '../api/types';
import { useRecipeImport } from './useRecipeImport';

vi.mock('../api/client', () => {
  class MockApiError extends Error {}
  return {
    ApiError: MockApiError,
    api: { recipes: { importFromUrl: vi.fn(), create: vi.fn() } },
  };
});

const importFromUrl = vi.mocked(api.recipes.importFromUrl);
const create = vi.mocked(api.recipes.create);

const IMPORTED: ImportedRecipe = {
  name: 'Lasagnes maison',
  servings: 4,
  ingredients: [{ name: 'Steak haché', quantity: 500, unit: 'g' }],
  steps: [{ order: 1, description: 'Préparer les ingrédients' }],
  sourceUrl: 'https://exemple.fr/lasagnes',
  extraction: 'json-ld',
  warnings: ['Nombre de personnes introuvable'],
};

const CREATED = { id: 7, title: 'Lasagnes maison' } as Recipe;

describe('useRecipeImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enchaîne extraction puis création et retourne les avertissements', async () => {
    importFromUrl.mockResolvedValue(IMPORTED);
    create.mockResolvedValue(CREATED);

    const { result } = renderHook(() => useRecipeImport());

    let outcome: Awaited<ReturnType<typeof result.current.importFromUrl>> = null;
    await act(async () => {
      outcome = await result.current.importFromUrl('www.exemple.fr/lasagnes');
    });

    // L'URL est normalisée avant l'appel réseau.
    expect(importFromUrl).toHaveBeenCalledWith('https://www.exemple.fr/lasagnes');
    expect(create).toHaveBeenCalledWith({
      title: 'Lasagnes maison',
      servings: 4,
      instructions: ['Préparer les ingrédients'],
      ingredients: [{ name: 'Steak haché', quantity: 500, unit: 'g' }],
    });
    expect(outcome).toEqual({ recipe: CREATED, warnings: ['Nombre de personnes introuvable'] });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('rejette une URL invalide sans appeler l’API', async () => {
    const { result } = renderHook(() => useRecipeImport());

    await act(async () => {
      expect(await result.current.importFromUrl('nawak')).toBeNull();
    });

    expect(importFromUrl).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/invalide/i);
  });

  it('remonte le message d’erreur de l’API', async () => {
    importFromUrl.mockRejectedValue(new ApiError('Aucune recette détectée sur cette page.'));

    const { result } = renderHook(() => useRecipeImport());

    await act(async () => {
      expect(await result.current.importFromUrl('https://exemple.fr/r')).toBeNull();
    });

    expect(result.current.error).toBe('Aucune recette détectée sur cette page.');
    expect(create).not.toHaveBeenCalled();
  });

  it('remplace une erreur inattendue par un message générique', async () => {
    importFromUrl.mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useRecipeImport());

    await act(async () => {
      await result.current.importFromUrl('https://exemple.fr/r');
    });

    expect(result.current.error).toMatch(/raison inattendue/i);
  });

  it('signale une création refusée après une extraction réussie', async () => {
    importFromUrl.mockResolvedValue(IMPORTED);
    create.mockRejectedValue(new ApiError('Le titre est obligatoire'));

    const { result } = renderHook(() => useRecipeImport());

    await act(async () => {
      await result.current.importFromUrl('https://exemple.fr/r');
    });

    expect(result.current.error).toBe('Le titre est obligatoire');
  });

  it('expose l’état de chargement pendant l’import', async () => {
    let resolveImport: (recipe: ImportedRecipe) => void = () => undefined;
    importFromUrl.mockReturnValue(
      new Promise<ImportedRecipe>((resolve) => {
        resolveImport = resolve;
      })
    );
    create.mockResolvedValue(CREATED);

    const { result } = renderHook(() => useRecipeImport());

    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = result.current.importFromUrl('https://exemple.fr/r');
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveImport(IMPORTED);
      await pending;
    });
    expect(result.current.loading).toBe(false);
  });

  it('efface l’erreur à la demande', async () => {
    const { result } = renderHook(() => useRecipeImport());

    await act(async () => {
      await result.current.importFromUrl('nawak');
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
