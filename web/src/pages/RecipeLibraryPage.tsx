import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Recipe, Tag } from '../api/types';
import RecipeCard from '../components/RecipeCard';
import TagFilterBar from '../components/TagFilterBar';

export default function RecipeLibraryPage() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

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
  }, [selectedTagNames]);

  function toggleTag(tagId: number) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <h1>Recettes</h1>
          <p>La bibliothèque des recettes que vous pouvez assigner à un plan de repas.</p>
        </div>
        <Link to="/recipes/new" className="btn btn-primary" data-qt-id="recipe-create-link">
          Nouvelle recette
        </Link>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div style={{ marginBottom: '1.4rem' }}>
        <TagFilterBar tags={allTags} selected={selectedTagIds} onToggle={toggleTag} />
      </div>

      {recipes === null && <p className="loading-hint">Chargement des recettes…</p>}

      {recipes && recipes.length === 0 && (
        <div className="empty-state">
          <h3>Aucune recette{selectedTagIds.length > 0 ? ' pour ces tags' : ''}</h3>
          <p>
            {selectedTagIds.length > 0
              ? 'Essayez un autre filtre ou ajoutez une nouvelle recette avec ces tags.'
              : 'Ajoutez votre première recette pour commencer à construire des plans de repas.'}
          </p>
          <Link to="/recipes/new" className="btn btn-primary">
            Créer une recette
          </Link>
        </div>
      )}

      {recipes && recipes.length > 0 && (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}
