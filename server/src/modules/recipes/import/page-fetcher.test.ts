import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../shared/errors.js';
import { assertImportableUrl } from './page-fetcher.js';

describe('assertImportableUrl', () => {
  it.each([
    'https://www.exemple.fr/ma-recette',
    'http://exemple.fr/recette?id=12',
    'https://sous.domaine.exemple.fr/recette#etapes',
  ])('accepte %s', (url) => {
    expect(assertImportableUrl(url).toString()).toContain('exemple.fr');
  });

  it('supprime les espaces autour de l’URL', () => {
    expect(assertImportableUrl('  https://exemple.fr/r  ').hostname).toBe('exemple.fr');
  });

  it.each([[undefined], [null], [''], ['   '], [42]])('refuse une URL absente (%j)', (value) => {
    expect(() => assertImportableUrl(value)).toThrow(ValidationError);
  });

  it.each(['pas-une-url', 'exemple.fr/recette', '//exemple.fr/recette'])(
    'refuse l’URL malformée %s',
    (url) => {
      expect(() => assertImportableUrl(url)).toThrow(/invalide/i);
    }
  );

  it.each(['ftp://exemple.fr/r', 'file:///etc/passwd', 'javascript:alert(1)', 'htt://exemple.fr'])(
    'refuse le protocole de %s',
    (url) => {
      expect(() => assertImportableUrl(url)).toThrow(ValidationError);
    }
  );

  it.each([
    'http://localhost:3000/api',
    'http://127.0.0.1/',
    'http://10.0.0.5/recette',
    'http://192.168.1.10/recette',
    'http://172.16.4.2/recette',
    'http://169.254.169.254/latest/meta-data',
    'http://nas.local/recette',
    'http://intranet/recette',
  ])('refuse la cible interne %s', (url) => {
    expect(() => assertImportableUrl(url)).toThrow(/réseau local/i);
  });
});
