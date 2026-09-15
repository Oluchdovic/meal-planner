import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { UNIT_LABELS } from '../api/types';
import type { MealPlan, ShoppingListItem } from '../api/types';

export default function ShoppingListPage() {
  const { id } = useParams();
  const planId = Number(id);

  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [items, setItems] = useState<ShoppingListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.plans.get(planId).then(setPlan).catch(() => undefined);
    api.plans
      .shoppingList(planId)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de génération de la liste'));
  }, [planId]);

  function formatQuantity(quantity: number): string {
    return quantity % 1 === 0 ? String(quantity) : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <h1>Liste de courses</h1>
          <p>{plan ? plan.name || `Plan du ${plan.startDate}` : 'Chargement du plan…'}</p>
        </div>
        <Link to={`/plans/${planId}`} className="btn btn-secondary" data-qt-id="shopping-list-back-link">
          Retour au plan
        </Link>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {items === null && !error && <p className="loading-hint">Génération de la liste…</p>}

      {items && items.length === 0 && (
        <div className="empty-state">
          <h3>Rien à acheter</h3>
          <p>Assignez des recettes à des créneaux du plan pour générer une liste de courses.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="card">
          <ul className="shopping-list">
            {items.map((item) => (
              <li key={`${item.name}::${item.unit}`}>
                <span>{item.name}</span>
                <span className="qty">
                  {formatQuantity(item.quantity)} {UNIT_LABELS[item.unit]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
