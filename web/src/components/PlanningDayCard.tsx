import { formatDayLabel } from '../lib/date';
import type { PlanSlot } from '../api/types';
import MealCard from './MealCard';

interface PlanningDayCardProps {
  date: string;
  meals: PlanSlot[];
  onAddMeal: (date: string) => void;
}

export default function PlanningDayCard({ date, meals, onAddMeal }: PlanningDayCardProps) {
  const dayLabel = formatDayLabel(date);

  return (
    <div className="card planning-day-card" data-qt-id={`planning-day-card-${date}`}>
      <div className="planning-day-card__date">{dayLabel}</div>

      {meals.length === 0 ? (
        <button
          type="button"
          className="planning-day-card__add-button"
          aria-label={`Ajouter un repas le ${dayLabel}`}
          onClick={() => onAddMeal(date)}
          data-qt-id={`planning-day-add-button-${date}`}
        >
          +
        </button>
      ) : (
        <div className="planning-day-card__meals">
          {meals.map((slot) => (
            <MealCard key={slot.id} slot={slot} />
          ))}
        </div>
      )}
    </div>
  );
}
