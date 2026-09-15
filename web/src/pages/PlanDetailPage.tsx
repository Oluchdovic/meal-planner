import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '../api/types';
import type { MealPlan, Recipe } from '../api/types';
import PlanSlotEditor from '../components/PlanSlotEditor';

function formatDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function PlanDetailPage() {
  const { id } = useParams();
  const planId = Number(id);
  const navigate = useNavigate();

  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.plans
      .get(planId)
      .then(setPlan)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Plan introuvable'));
    api.recipes.list().then(setRecipes).catch(() => undefined);
  }, [planId]);

  const dates = useMemo(() => {
    if (!plan) return [];
    const list: string[] = [];
    const cursor = new Date(`${plan.startDate}T00:00:00Z`);
    const end = new Date(`${plan.endDate}T00:00:00Z`);
    while (cursor <= end) {
      list.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return list;
  }, [plan]);

  async function handleSlotChange(
    slotId: number,
    input: { recipeId: number | null; servingsOverride: number | null }
  ) {
    if (!plan) return;
    try {
      const updated = await api.plans.updateSlot(planId, slotId, input);
      setPlan((prev) =>
        prev ? { ...prev, slots: prev.slots.map((s) => (s.id === slotId ? updated : s)) } : prev
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la mise à jour du créneau");
    }
  }

  async function handleDeletePlan() {
    if (!window.confirm('Supprimer ce plan de repas ?')) return;
    try {
      await api.plans.delete(planId);
      navigate('/plans');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de la suppression');
    }
  }

  if (error) {
    return <div className="banner-error">{error}</div>;
  }

  if (!plan) {
    return <p className="loading-hint">Chargement du plan…</p>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <h1>{plan.name || `Plan du ${plan.startDate}`}</h1>
          <p>
            {plan.startDate} → {plan.endDate}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Link to={`/plans/${planId}/shopping-list`} className="btn btn-primary" data-qt-id="plan-shopping-list-link">
            Liste de courses
          </Link>
          <button type="button" className="btn btn-danger" onClick={handleDeletePlan} data-qt-id="plan-delete-button">
            Supprimer le plan
          </button>
        </div>
      </div>

      <div className="plan-grid-wrap">
        <table className="plan-grid">
          <thead>
            <tr>
              <th>Date</th>
              {MEAL_TYPES.map((mealType) => (
                <th key={mealType}>{MEAL_TYPE_LABELS[mealType]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => (
              <tr key={date}>
                <th scope="row">{formatDateLabel(date)}</th>
                {MEAL_TYPES.map((mealType) => {
                  const slot = plan.slots.find((s) => s.date === date && s.mealType === mealType);
                  if (!slot) return <td key={mealType} />;
                  return (
                    <td key={mealType}>
                      <PlanSlotEditor
                        slot={slot}
                        recipes={recipes}
                        onChange={(input) => handleSlotChange(slot.id, input)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
