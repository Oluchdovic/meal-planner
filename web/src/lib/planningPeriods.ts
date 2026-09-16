import type { DateRange } from './date';
import { getMonthRange, getWeekRange } from './date';

export type PlanningPeriodKey = 'this-week' | 'next-week' | 'month';

export interface PlanningPeriodOption {
  key: PlanningPeriodKey;
  label: string;
  getRange: () => DateRange;
}

// Add an entry here to expose a new quick period in PlanningPeriodSelector.
export const PLANNING_PERIODS: PlanningPeriodOption[] = [
  { key: 'this-week', label: 'Cette semaine', getRange: () => getWeekRange(0) },
  { key: 'next-week', label: 'Semaine prochaine', getRange: () => getWeekRange(1) },
  { key: 'month', label: 'Tout le mois', getRange: () => getMonthRange(0) },
];
