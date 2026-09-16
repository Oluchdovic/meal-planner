import type { PlanSlot } from '../api/types';
import PlanningDayCard from './PlanningDayCard';

interface PlanningViewProps {
  dates: string[];
  mealsByDate: Map<string, PlanSlot[]>;
  onAddMeal: (date: string) => void;
}

export default function PlanningView({ dates, mealsByDate, onAddMeal }: PlanningViewProps) {
  return (
    <div className="planning-view" data-qt-id="planning-view">
      {dates.map((date) => (
        <PlanningDayCard key={date} date={date} meals={mealsByDate.get(date) ?? []} onAddMeal={onAddMeal} />
      ))}
    </div>
  );
}
