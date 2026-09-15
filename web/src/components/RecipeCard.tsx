import { Link } from 'react-router-dom';
import type { Recipe } from '../api/types';

interface RecipeCardProps {
  recipe: Recipe;
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const totalTime = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  return (
    <Link to={`/recipes/${recipe.id}/edit`} className="card recipe-card" data-qt-id={`recipe-card-${recipe.id}`}>
      <div
        className="recipe-card__photo"
        style={recipe.photoPath ? { backgroundImage: `url(/photos/${recipe.photoPath})` } : undefined}
      >
        {!recipe.photoPath && <span>Sans photo</span>}
      </div>
      <div className="recipe-card__body">
        <div className="recipe-card__title">{recipe.title}</div>
        <div className="recipe-card__meta">
          <span className="meta-pill">{recipe.servings} portions</span>
          {totalTime > 0 && <span className="meta-pill">{totalTime} min</span>}
        </div>
        {recipe.tags.length > 0 && (
          <div className="tag-row">
            {recipe.tags.map((tag) => (
              <span key={tag.id} className="tag-chip">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
