export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function enumerateDatesIso(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function isoWeekday(iso: string): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function startOfIsoWeek(iso: string): string {
  return addDaysIso(iso, 1 - isoWeekday(iso));
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export function getWeekRange(weekOffset: number): DateRange {
  const monday = addDaysIso(startOfIsoWeek(todayIso()), weekOffset * 7);
  return { startDate: monday, endDate: addDaysIso(monday, 6) };
}

export function getMonthRange(monthOffset = 0): DateRange {
  const today = new Date(`${todayIso()}T00:00:00Z`);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + monthOffset;
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  return { startDate: first.toISOString().slice(0, 10), endDate: last.toISOString().slice(0, 10) };
}

export function formatDayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatFullDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
