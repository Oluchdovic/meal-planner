import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { MealPlan, PlanSlot } from '../api/types';
import { enumerateDatesIso } from '../lib/date';
import { PLANNING_PERIODS } from '../lib/planningPeriods';
import type { PlanningPeriodKey } from '../lib/planningPeriods';
import PlanningHeader from '../components/PlanningHeader';
import PlanningPeriodSelector from '../components/PlanningPeriodSelector';
import PlanningView from '../components/PlanningView';
import EmptyPlanningState from '../components/EmptyPlanningState';

export default function MealPlanningPage() {
  const [periodKey, setPeriodKey] = useState<PlanningPeriodKey>('this-week');
  const [plans, setPlans] = useState<MealPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.plans
      .list()
      .then(setPlans)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement du planning'));
  }, []);

  const range = useMemo(() => {
    const period = PLANNING_PERIODS.find((p) => p.key === periodKey) ?? PLANNING_PERIODS[0];
    return period.getRange();
  }, [periodKey]);

  const dates = useMemo(() => enumerateDatesIso(range.startDate, range.endDate), [range]);

  const mealsByDate = useMemo(() => {
    const map = new Map<string, PlanSlot[]>();
    if (!plans) return map;
    for (const plan of plans) {
      for (const slot of plan.slots) {
        if (!slot.recipeId) continue;
        if (slot.date < range.startDate || slot.date > range.endDate) continue;
        const dayMeals = map.get(slot.date) ?? [];
        dayMeals.push(slot);
        map.set(slot.date, dayMeals);
      }
    }
    return map;
  }, [plans, range]);

  const totalMeals = useMemo(
    () => Array.from(mealsByDate.values()).reduce((sum, dayMeals) => sum + dayMeals.length, 0),
    [mealsByDate]
  );

  function handleAddMeal(date: string) {
    // TODO: ouvrir le flux d'ajout d'un repas pour la date `date`
    void date;
  }

  function handlePlanAutomatically() {
    // TODO: déclencher la planification automatique des repas pour la période sélectionnée
  }

  return (
    <div className="meal-planning-page">
      <div className="page-header">
        <div className="page-header__text">
          <h1>Mon Planning</h1>
          <p>Visualisez vos repas planifiés et changez de période en un clic.</p>
        </div>
        <PlanningPeriodSelector options={PLANNING_PERIODS} selectedKey={periodKey} onSelect={setPeriodKey} />
      </div>

      {error && <div className="banner-error">{error}</div>}

      <PlanningHeader totalMeals={totalMeals} />

      {plans === null && !error && <p className="loading-hint">Chargement du planning…</p>}

      {plans !== null && totalMeals === 0 && <EmptyPlanningState onPlanAutomatically={handlePlanAutomatically} />}

      {plans !== null && totalMeals > 0 && (
        <PlanningView dates={dates} mealsByDate={mealsByDate} onAddMeal={handleAddMeal} />
      )}
    </div>
  );
}
