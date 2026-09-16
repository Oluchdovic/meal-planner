import type { ReactNode } from 'react';
import type { Recipe } from '../api/types';
import RecipeCard from './RecipeCard';

interface RecipeListProps {
  recipes: Recipe[];
  /** Affiché à la place de la grille quand aucune recette ne correspond. */
  emptyState?: ReactNode;
}

/** Grille de recettes de la bibliothèque. */
export default function RecipeList({ recipes, emptyState = null }: RecipeListProps) {
  if (recipes.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="recipe-grid" data-qt-id="recipeLibrary__recipeList">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}
