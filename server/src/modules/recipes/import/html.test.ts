import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities, extractJsonLdNodes, findElements, getAttribute, htmlToText } from './html.js';

describe('decodeHtmlEntities', () => {
  it('décode les entités nommées courantes', () => {
    expect(decodeHtmlEntities('cr&egrave;me fra&icirc;che &amp; sel')).toBe('crème fraîche & sel');
  });

  it('décode les entités numériques décimales et hexadécimales', () => {
    expect(decodeHtmlEntities('&#233;chalote &#x00E8;re')).toBe('échalote ère');
  });

  it('laisse intactes les entités inconnues', () => {
    expect(decodeHtmlEntities('&unknownentity; ok')).toBe('&unknownentity; ok');
  });
});

describe('htmlToText', () => {
  it('retire les balises et normalise les espaces', () => {
    expect(htmlToText('<p>Faire   <strong>fondre</strong> le beurre</p>')).toBe(
      'Faire fondre le beurre'
    );
  });

  it('transforme les sauts de ligne et fins de bloc en retours à la ligne', () => {
    expect(htmlToText('<li>Étape 1</li><li>Étape 2</li>')).toBe('Étape 1\nÉtape 2');
    expect(htmlToText('Un<br>Deux')).toBe('Un\nDeux');
  });

  it('ignore le contenu des scripts et des styles', () => {
    expect(htmlToText('<div>Sel<script>var x = 1;</script></div>')).toBe('Sel');
  });
});

describe('extractJsonLdNodes', () => {
  it('extrait plusieurs blocs JSON-LD', () => {
    const html = `
      <script type="application/ld+json">{"@type":"Organization","name":"Site"}</script>
      <script type="application/ld+json">{"@type":"Recipe","name":"Lasagnes"}</script>
    `;
    expect(extractJsonLdNodes(html)).toEqual([
      { '@type': 'Organization', name: 'Site' },
      { '@type': 'Recipe', name: 'Lasagnes' },
    ]);
  });

  it('ignore les blocs illisibles sans faire échouer les autres', () => {
    const html = `
      <script type="application/ld+json">{ ceci n'est pas du JSON }</script>
      <script type="application/ld+json">{"@type":"Recipe"}</script>
    `;
    expect(extractJsonLdNodes(html)).toEqual([{ '@type': 'Recipe' }]);
  });

  it('tolère les enveloppes CDATA et les virgules traînantes', () => {
    const html = `<script type="application/ld+json">//<![CDATA[
      {"@type":"Recipe","name":"Tarte",}
    //]]></script>`;
    expect(extractJsonLdNodes(html)).toEqual([{ '@type': 'Recipe', name: 'Tarte' }]);
  });
});

describe('findElements / getAttribute', () => {
  it('délimite le contenu interne malgré des balises imbriquées de même nom', () => {
    const html = '<div class="a"><div>interne</div>fin</div>';
    const [element] = findElements(html, (tag, attrs) => tag === 'div' && attrs.includes('"a"'));
    expect(element?.innerHtml).toBe('<div>interne</div>fin');
  });

  it('retourne un contenu vide pour les éléments auto-fermants', () => {
    const [element] = findElements('<meta content="4"><p>x</p>', (tag) => tag === 'meta');
    expect(element?.innerHtml).toBe('');
  });

  it('lit les attributs quels que soient les guillemets', () => {
    expect(getAttribute(` class='a b' data-x=42`, 'class')).toBe('a b');
    expect(getAttribute(` data-x=42`, 'data-x')).toBe('42');
    expect(getAttribute(` class="a"`, 'id')).toBeNull();
  });
});
