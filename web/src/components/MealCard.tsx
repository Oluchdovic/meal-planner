import { MEAL_TYPE_LABELS } from '../api/types';
import type { PlanSlot } from '../api/types';

interface MealCardProps {
  slot: PlanSlot;
}

export default function MealCard({ slot }: MealCardProps) {
  return (
    <div className="card meal-card" data-qt-id={`meal-card-${slot.id}`}>
      <span className="meal-card__type">{MEAL_TYPE_LABELS[slot.mealType]}</span>
      <span className="meal-card__title">{slot.recipeTitle}</span>
      {slot.servingsOverride !== null && <span className="meta-pill">{slot.servingsOverride} portions</span>}
    </div>
  );
}
