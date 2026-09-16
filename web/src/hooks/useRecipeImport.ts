import { useCallback, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Recipe } from '../api/types';
import { toRecipeInput } from '../lib/importedRecipe';
import { normalizeRecipeUrl } from '../lib/recipeUrl';

/**
 * Import d'une recette depuis une URL, en deux temps :
 * 1. `POST /api/recipes/import` extrait les données (aucun effet de bord) ;
 * 2. `POST /api/recipes` enregistre la recette dans la bibliothèque.
 *
 * Toute la gestion d'état (chargement, erreur) est concentrée ici pour que les
 * composants de présentation restent testables sans réseau.
 */

const INVALID_URL_MESSAGE =
  'Cette adresse est invalide. Exemple attendu : https://exemple.fr/ma-recette';
const UNEXPECTED_ERROR_MESSAGE =
  'L’import a échoué pour une raison inattendue. Réessayez ou saisissez la recette manuellement.';

export interface ImportOutcome {
  recipe: Recipe;
  /** Messages d'extraction partielle à afficher après un import réussi. */
  warnings: string[];
}

export interface UseRecipeImportResult {
  loading: boolean;
  error: string | null;
  /** Retourne la recette créée, ou `null` si l'import a échoué (voir `error`). */
  importFromUrl: (url: string) => Promise<ImportOutcome | null>;
  clearError: () => void;
}

export function useRecipeImport(): UseRecipeImportResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const importFromUrl = useCallback(async (rawUrl: string): Promise<ImportOutcome | null> => {
    const url = normalizeRecipeUrl(rawUrl);
    if (!url) {
      setError(INVALID_URL_MESSAGE);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const imported = await api.recipes.importFromUrl(url);
      const recipe = await api.recipes.create(toRecipeInput(imported));
      return { recipe, warnings: imported.warnings };
    } catch (err) {
      setError(err instanceof ApiError ? err.message : UNEXPECTED_ERROR_MESSAGE);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, importFromUrl, clearError };
}
