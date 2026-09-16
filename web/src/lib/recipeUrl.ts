/**
 * Validation d'URL côté client, sans dépendance à React ni à l'API.
 * Le serveur revalide systématiquement (et bloque en plus les cibles internes) :
 * ce module ne sert qu'à éviter un aller-retour réseau inutile.
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const EXPLICIT_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Normalise une saisie utilisateur en URL absolue.
 * Tolère l'absence de schéma (`www.exemple.fr/r` -> `https://www.exemple.fr/r`).
 * Retourne `null` si l'adresse ne peut pas être une page web publique.
 */
export function normalizeRecipeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = EXPLICIT_SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return null;

  // Un nom d'hôte sans point désigne une machine du réseau local.
  const hostname = url.hostname;
  if (!hostname.includes('.') || hostname.startsWith('.') || hostname.endsWith('.')) return null;

  return url.toString();
}

export function isValidRecipeUrl(value: string): boolean {
  return normalizeRecipeUrl(value) !== null;
}
