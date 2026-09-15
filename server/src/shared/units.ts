export const UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'unite',
  'cas',
  'cac',
  'pincee',
  'tranche',
  'botte',
  'gousse',
  'sachet',
] as const;

export type Unit = (typeof UNITS)[number];

export function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && (UNITS as readonly string[]).includes(value);
}
