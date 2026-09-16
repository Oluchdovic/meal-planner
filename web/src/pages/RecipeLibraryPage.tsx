import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Recipe, Tag } from '../api/types';
import AddRecipeButton from '../components/AddRecipeButton';
import RecipeImportForm from '../components/RecipeImportForm';
import RecipeList from '../components/RecipeList';
import TagFilterBar from '../components/TagFilterBar';
import { useRecipeImport } from '../hooks/useRecipeImport';
import type { ImportOutcome } from '../hooks/useRecipeImport';

export default function RecipeLibraryPage() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [importMode, setImportMode] = useState(false);
  const [lastImport, setLastImport] = useState<ImportOutcome | null>(null);
  // Incrémenté après un import pour relancer le chargement de la liste.
  const [reloadToken, setReloadToken] = useState(0);

  const { loading: importing, error: importError, importFromUrl, clearError } = useRecipeImport();

  useEffect(() => {
    api.tags
      .list()
      .then(setAllTags)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement des tags'));
  }, []);

  const selectedTagNames = useMemo(
    () => allTags.filter((t) => selectedTagIds.includes(t.id)).map((t) => t.name),
    [allTags, selectedTagIds]
  );

  useEffect(() => {
    setRecipes(null);
    api.recipes
      .list(selectedTagNames)
      .then(setRecipes)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement des recettes'));
  }, [selectedTagNames, reloadToken]);

  function toggleTag(tagId: number) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  const openImportMode = useCallback(() => {
    setLastImport(null);
    clearError();
    setImportMode(true);
  }, [clearError]);

  const closeImportMode = useCallback(() => {
    clearError();
    setImportMode(false);
  }, [clearError]);

  const handleImportSubmit = useCallback(
    async (url: string) => {
      const outcome = await importFromUrl(url);
      if (!outcome) return; // l'erreur reste affichée dans le formulaire

      setImportMode(false);
      setLastImport(outcome);
      setReloadToken((token) => token + 1);
    },
    [importFromUrl]
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <h1>Recettes</h1>
          <p>La bibliothèque des recettes que vous pouvez assigner à un plan de repas.</p>
        </div>

        {importMode ? (
          <RecipeImportForm
            onSubmit={handleImportSubmit}
            onCancel={closeImportMode}
            loading={importing}
            error={importError}
            onDirty={clearError}
          />
        ) : (
          <div className="page-header__actions-group" data-qt-id="recipeLibrary__toolbar">
            <AddRecipeButton onClick={openImportMode} />
            <Link to="/recipes/new" className="btn btn-secondary" data-qt-id="recipe-create-link">
              Nouvelle recette
            </Link>
          </div>
        )}
      </div>

      {error && <div className="banner-error">{error}</div>}

      {lastImport && (
        <div className="banner-success" role="status" data-qt-id="recipeLibrary__banner_importSuccess">
          <p>
            « {lastImport.recipe.title} » a été ajoutée à votre bibliothèque.{' '}
            <Link to={`/recipes/${lastImport.recipe.id}/edit`}>Compléter la recette</Link>
          </p>
          {lastImport.warnings.length > 0 && (
            <ul className="banner-success__warnings">
              {lastImport.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setLastImport(null)}
            data-qt-id="recipeLibrary__banner_dismissImportSuccessButton"
          >
            Fermer
          </button>
        </div>
      )}

      <div style={{ marginBottom: '1.4rem' }}>
        <TagFilterBar tags={allTags} selected={selectedTagIds} onToggle={toggleTag} />
      </div>

      {recipes === null && <p className="loading-hint">Chargement des recettes…</p>}

      {recipes && (
        <RecipeList
          recipes={recipes}
          emptyState={
            <div className="empty-state">
              <h3>Aucune recette{selectedTagIds.length > 0 ? ' pour ces tags' : ''}</h3>
              <p>
                {selectedTagIds.length > 0
                  ? 'Essayez un autre filtre ou ajoutez une nouvelle recette avec ces tags.'
                  : 'Importez une recette depuis une URL ou saisissez-la manuellement pour commencer.'}
              </p>
              <Link to="/recipes/new" className="btn btn-primary">
                Créer une recette
              </Link>
            </div>
          }
        />
      )}
    </div>
  );
}
