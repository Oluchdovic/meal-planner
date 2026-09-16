import type { PlanningPeriodKey, PlanningPeriodOption } from '../lib/planningPeriods';

interface PlanningPeriodSelectorProps {
  options: PlanningPeriodOption[];
  selectedKey: PlanningPeriodKey;
  onSelect: (key: PlanningPeriodKey) => void;
}

export default function PlanningPeriodSelector({ options, selectedKey, onSelect }: PlanningPeriodSelectorProps) {
  return (
    <div
      className="planning-period-selector"
      role="group"
      aria-label="Choisir la période affichée"
      data-qt-id="planning-period-selector"
    >
      {options.map((option) => {
        const isActive = option.key === selectedKey;
        return (
          <button
            key={option.key}
            type="button"
            className={`planning-period-selector__option${isActive ? ' planning-period-selector__option--active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onSelect(option.key)}
            data-qt-id={`planning-period-${option.key}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
