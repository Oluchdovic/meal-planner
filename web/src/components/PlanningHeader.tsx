import { formatFullDateLabel, todayIso } from '../lib/date';

interface PlanningHeaderProps {
  totalMeals: number;
}

export default function PlanningHeader({ totalMeals }: PlanningHeaderProps) {
  return (
    <div className="planning-header" data-qt-id="planning-header">
      <div className="planning-header__date">{formatFullDateLabel(todayIso())}</div>
      <div className="planning-header__count">
        {totalMeals} repas planifié{totalMeals === 1 ? '' : 's'}
      </div>
    </div>
  );
}
