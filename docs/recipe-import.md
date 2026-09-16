# Import d'une recette depuis une URL

Documentation technique de la fonctionnalité « Ajouter une recette » de la bibliothèque : l'utilisateur colle l'URL d'une page de recette, l'application en extrait le titre, le nombre de personnes, les ingrédients et les étapes, puis crée la recette.

## 1. Vue d'ensemble du flux

```
RecipeLibraryPage
  └─ useRecipeImport
       ├─ 1. POST /api/recipes/import  { url }        -> ImportedRecipeDto  (extraction, sans effet de bord)
       └─ 2. POST /api/recipes         RecipeInput    -> Recipe             (création réelle)
                                                         puis rechargement de la liste
```

Côté serveur, `POST /api/recipes/import` enchaîne :

```
assertImportableUrl   (validation + garde SSRF)
      ↓
fetchRecipePage       (fetch borné en temps, taille et type de contenu)
      ↓
parseJsonLdRecipe  ?? parseMicrodataRecipe  ?? parseHeuristicRecipe   -> RawRecipe
      ↓
normalizeRecipe       (unités, quantités, portions, étapes, avertissements)
      ↓
ImportedRecipeDto
```

### Pourquoi l'endpoint ne persiste rien

L'extraction est un appel réseau sortant, lent et faillible ; la création est une écriture locale, rapide et déjà couverte par `RecipesRepository.create` (validation des unités, transaction, tags). Les séparer permet :

- de réutiliser `POST /api/recipes` sans dupliquer sa validation ;
- de tester l'extraction sans base de données (aucun test n'ouvre SQLite) ;
- d'ajouter plus tard un écran « vérifier avant d'enregistrer » sans toucher au backend.

Le coût est un aller-retour HTTP supplémentaire, négligeable devant le temps de récupération de la page distante.

## 2. Contrat d'API

### Requête

```http
POST /api/recipes/import
Content-Type: application/json

{ "url": "https://www.exemple.fr/ma-recette" }
```

### Réponse `200`

```json
{
  "name": "Lasagnes maison",
  "servings": 4,
  "ingredients": [{ "name": "Steak haché", "quantity": 500, "unit": "g" }],
  "steps": [{ "order": 1, "description": "Préparer les ingrédients" }],
  "sourceUrl": "https://www.exemple.fr/ma-recette",
  "extraction": "json-ld",
  "warnings": []
}
```

Champs au-delà du modèle cible demandé, tous additifs :

| champ | rôle |
|---|---|
| `sourceUrl` | URL finale après redirections (traçabilité) |
| `extraction` | `json-ld` \| `microdata` \| `heuristic` — stratégie qui a abouti |
| `warnings` | messages français décrivant les données manquantes ou approximées |

`quantity` et `unit` sont **optionnels**, conformément au modèle cible :

- `quantity` est absent quand la ligne d'origine ne contient aucun nombre (« Sel et poivre ») ;
- `unit` est absent quand l'unité d'origine n'a pas d'équivalent dans l'énumération fermée de [`shared/units.ts`](../server/src/shared/units.ts) (« 1 verre de lait »).

Le client applique alors les valeurs de repli `quantity: 1` / `unit: 'unite'` dans [`web/src/lib/importedRecipe.ts`](../web/src/lib/importedRecipe.ts). Ce choix garde le DTO honnête (il ne prétend pas connaître une quantité qu'il n'a pas lue) tout en produisant toujours une recette enregistrable.

### Codes d'erreur

Tous renvoient `{ "error": "<message en français>" }` via le gestionnaire d'erreurs global et les classes de [`shared/errors.ts`](../server/src/shared/errors.ts).

| cas | statut | message (extrait) |
|---|---|---|
| URL absente ou non textuelle | `400` | « L'URL de la recette est obligatoire » |
| URL malformée | `400` | « L'URL fournie est invalide. Attendu : … » |
| Protocole autre que `http(s)` | `400` | « Seules les adresses http:// et https:// peuvent être importées » |
| Cible interne (loopback, RFC 1918, TLD local) | `400` | « Cette adresse pointe vers le réseau local… » |
| Site injoignable (DNS, TCP, TLS) | `502` | « Le site … est inaccessible » |
| Réponse HTTP ≥ 400 | `502` | « Le site … a refusé la requête (erreur HTTP 403) » |
| Délai dépassé (> 10 s) | `504` | « Le site … n'a pas répondu dans le délai de 10 s » |
| Contenu non HTML, ou page vide | `422` | « Cette adresse ne renvoie pas une page web exploitable » |
| Aucune recette détectée | `422` | « Aucune recette détectée sur cette page… » |
| Recette sans titre exploitable | `422` | « …aucun titre n'a pu être lu » |
| Recette sans ingrédient **ni** étape | `422` | « …ni ingrédients ni étapes n'ont pu être lus » |
| Données partielles | `200` | recette créée + `warnings` affichés dans un bandeau |

Les données partielles ne sont **pas** une erreur : une recette sans étapes reste utile pour la liste de courses. L'utilisateur est averti et peut compléter depuis le formulaire de recette.

## 3. Stratégies d'extraction

Trois niveaux, appliqués dans l'ordre, le premier qui produit un résultat gagne ([`import-service.ts`](../server/src/modules/recipes/import/import-service.ts)).

### 3.1 JSON-LD Schema.org — chemin principal

[`schemaorg-parser.ts`](../server/src/modules/recipes/import/schemaorg-parser.ts) lit les blocs `<script type="application/ld+json">` et y cherche un nœud de type `Recipe`. C'est le cas de l'immense majorité des sites de recettes, qui balisent leurs pages pour le référencement Google.

Formes gérées, toutes rencontrées en production :

- nœud unique, tableau racine, ou `@graph` (Yoast, Rank Math, WordPress) ;
- types multiples : `"@type": ["NewsArticle", "Recipe"]` ;
- types préfixés : `"@type": "https://schema.org/Recipe"` ;
- `recipeYield` en nombre, chaîne (`"4 personnes"`) ou tableau ;
- `recipeIngredient` (et l'alias historique `ingredients`) ;
- `recipeInstructions` en chaîne unique, tableau de chaînes, `HowToStep`, ou `HowToSection` imbriquant un `itemListElement` ;
- HTML résiduel dans les champs, décodé et nettoyé ;
- blocs JSON invalides (virgules traînantes, enveloppe `CDATA`) : réparation opportuniste, sinon le bloc est ignoré sans faire échouer les autres.

### 3.2 Microdata Schema.org — premier repli

Même fichier : lecture des attributs `itemprop="recipeIngredient"`, `recipeInstructions`, `name`, `recipeYield`, y compris portés par `<meta itemprop=… content=…>`. Ne déclenche que si la page déclare explicitement ces propriétés.

### 3.3 Heuristique HTML — dernier repli

[`fallback-parser.ts`](../server/src/modules/recipes/import/fallback-parser.ts) devine la structure :

- **titre** : `og:title`, puis `<h1>`, puis `<title>` amputé de son suffixe de site (« Soupe de courge - MonBlog ») ;
- **ingrédients / étapes** : conteneurs dont `class` ou `id` évoque le concept (`/ingredient/i`, `/instruction|preparation|étape|step|directions|method/i`), puis leurs `<li>` (ou `<p>` à défaut) ;
- **portions** : première occurrence de `« N personnes | parts | portions | couverts »` dans le texte de la page.

Garde-fous : au moins 2 ingrédients requis, 80 éléments maximum, déduplication, longueur minimale de 12 caractères pour une étape. Un import heuristique remonte toujours un avertissement explicite.

### Limites connues

- **Contenu rendu côté client.** Une page qui construit sa recette en JavaScript renvoie un HTML vide de données ; `fetch` n'exécute pas de JS. Il faudrait un navigateur headless (Playwright), hors de proportion pour cette application.
- **Anti-bot.** Cloudflare, captchas ou blocage par User-Agent se traduisent par un `502` (« a refusé la requête »).
- **Heuristique fragile.** Elle ne distingue pas un encart « recettes similaires » d'une vraie liste, et rate tout balisage non nommé (`<div class="c-12">`). C'est un filet de sécurité, pas une garantie.
- **Parsing HTML maison.** [`html.ts`](../server/src/modules/recipes/import/html.ts) fait du comptage de balises par expressions régulières, pas de l'analyse conforme au standard. Suffisant pour isoler des `<script>` et des `<li>` ; insuffisant pour du HTML très malformé. Voir § 6.
- **Sections d'ingrédients.** « Pour la pâte : » / « Pour la garniture : » sont écartés ; le regroupement est perdu, les ingrédients sont mis à plat.
- **Pas de photo, pas de temps de préparation, pas de tags.** Volontairement hors périmètre : la recette importée est complétée depuis le formulaire existant.

## 4. Normalisation

[`recipe-parser.ts`](../server/src/modules/recipes/import/recipe-parser.ts) transforme le texte libre en données typées.

### Quantités

Formats reconnus : entiers, décimaux à virgule ou point (`1,5`), fractions ASCII (`1/2`, `1 1/2`), fractions Unicode (`½`, `1½`), nombres en mots (`une`, `deux`, … `douze`, `demi`). Pour un intervalle (`2 à 3 gousses`, `3-4`), la **borne basse** est retenue.

### Unités

Table de synonymes français et anglais ramenée à l'énumération fermée de `shared/units.ts`, insensible à la casse, aux accents et aux points (`c. à s.`, `cuillères à soupe`, `cuil a soupe` → `cas`). Les unités hors énumération sont **converties** quand c'est possible : `mg` → `g` (÷1000), `cl` → `ml` (×10), `dl` → `ml` (×100). Le rapprochement se fait par jetons entiers, ce qui évite de prendre un adjectif pour une unité (« 3 **gros** oignons » n'est pas « 3 g »).

Le nom est ensuite débarrassé du connecteur français qui suit l'unité (`de`, `du`, `des`, `de la`, `d'`, `l'`), uniquement lorsqu'une quantité a été lue — « De la crème fraîche » reste intact.

### Portions

`recipeYield` interprété via le premier nombre trouvé, arrondi au demi (le formulaire accepte un pas de 0,5) et plafonné à 100. À défaut : **4 portions** (valeur par défaut du formulaire de recette) + avertissement.

### Étapes

Chaque bloc est converti en texte, découpé sur les sauts de ligne, débarrassé de sa numérotation existante (`Étape 1 :`, `2.`), vidé de ses doublons consécutifs, puis renuméroté de 1 à N de façon contiguë. Plafond à 200 étapes.

## 5. Sécurité et robustesse du fetch

[`page-fetcher.ts`](../server/src/modules/recipes/import/page-fetcher.ts) — l'endpoint fait émettre au serveur une requête vers une URL fournie par l'utilisateur, ce qui en fait une surface SSRF.

| protection | détail |
|---|---|
| Protocoles | `http:` et `https:` uniquement (`file:`, `ftp:`, `javascript:` refusés) |
| Cibles internes | `localhost`, `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16` (métadonnées cloud), `::1`, `fc00::/7`, `fe80::/10`, TLD `.local`/`.internal`/`.lan`, et tout nom d'hôte sans point |
| Délai | 10 s via `AbortSignal.timeout`, mappé sur un `504` |
| Taille | lecture en flux, coupée à 4 Mio |
| Type de contenu | HTML / XHTML / texte exigé |
| Encodage | `charset` de l'en-tête respecté (certains sites francophones servent encore du latin-1) |

**Limite connue :** la résolution DNS n'est pas vérifiée. Un domaine public qui pointe vers une IP privée (attaque par rebinding DNS) passe la garde. Pour une application mono-utilisateur auto-hébergée le risque est marginal ; en multi-utilisateurs il faudrait résoudre le nom et valider l'IP avant connexion, via un agent HTTP personnalisé.

Aucun contenu distant n'est réinjecté en HTML : le texte extrait est rendu par React, qui échappe systématiquement.

## 6. Bibliothèques évaluées (question bonus)

**Décision retenue : aucune dépendance runtime ajoutée.** L'extraction JSON-LD — le chemin qui couvre la quasi-totalité des cas réels — ne demande qu'à isoler des balises `<script>` et à parcourir du JSON, soit ~150 lignes déjà couvertes par des tests. Le conteneur Docker, la surface d'audit et le `yarn.lock` restent inchangés.

Les pistes ci-dessous restent pertinentes si le besoin évolue ; **chacune demande une vérification (maintenance, licence, poids) avant adoption** — elles n'ont pas été installées dans ce projet.

| piste | apport | réserve |
|---|---|---|
| `cheerio` | vrai parseur HTML avec sélecteurs CSS ; remplacerait avantageusement `html.ts` et rendrait l'heuristique bien plus fiable | ~1 Mo et quelques dépendances transitives, pour un gain nul sur le chemin JSON-LD |
| `microdata-node`, `web-auto-extractor` | extraction générique microdata / RDFa / JSON-LD | redondant avec le chemin principal ; utile surtout pour élargir le repli microdata |
| scrapers dédiés aux recettes (famille `recipe-scraper`) | adaptateurs par site, extraction prête à l'emploi | orientés sites anglophones, couverture et maintenance à vérifier site par site, et retour à normaliser vers nos unités |
| parseurs de lignes d'ingrédients (famille `parse-ingredient`) | remplacerait notre table de synonymes | unités et grammaire anglaises ; inadapté à « 2 cuillères à soupe d'huile d'olive » |
| `schema-dts` | types TypeScript pour Schema.org | typage seul, aucune extraction ; utile pour durcir `schemaorg-parser.ts` |
| Playwright / navigateur headless | seule réponse aux pages rendues en JavaScript | plusieurs centaines de Mo, hors de proportion ici |

**Recommandation :** si le taux d'échec de l'heuristique devient gênant, introduire `cheerio` en premier et réécrire `fallback-parser.ts` par-dessus. Le découpage actuel (un fichier par stratégie, `RawRecipe` comme contrat commun) rend ce remplacement local.

## 7. Tests

```bash
yarn test                                 # les deux workspaces
yarn workspace meal-planner-server test   # 105 tests
yarn workspace meal-planner-web test      # 37 tests
```

| fichier | couvre |
|---|---|
`server/.../html.test.ts` | entités, texte, blocs JSON-LD, délimitation des balises
`server/.../schemaorg-parser.test.ts` | variantes JSON-LD (`@graph`, types multiples, `HowToSection`), microdata
`server/.../recipe-parser.test.ts` | portions, quantités, unités, connecteurs, étapes, avertissements
`server/.../page-fetcher.test.ts` | validation d'URL et garde SSRF
`server/.../import-service.test.ts` | orchestration, bascule entre stratégies, tous les cas d'erreur — `PageFetcher` injecté, **aucun appel réseau**
`web/src/lib/recipeUrl.test.ts` | validation et normalisation côté client
`web/src/lib/importedRecipe.test.ts` | mapping `ImportedRecipe` → `RecipeInput` et valeurs de repli
`web/src/components/RecipeImportForm.test.tsx` | états du formulaire, clavier, accessibilité
`web/src/hooks/useRecipeImport.test.ts` | enchaînement des deux appels, chargement, messages d'erreur

Le service accepte un `PageFetcher` par injection de constructeur : les tests fournissent du HTML de fixture, ce qui rend la suite déterministe et hors-ligne. Les codes d'erreur HTTP réels ont été vérifiés par un appel manuel sur l'endpoint (`400`, `400`, `400`, `400`, `502`) ; aucun site de recettes tiers n'a été contacté.

## 8. Frontend

```
RecipeLibraryPage                    src/pages/RecipeLibraryPage.tsx
├── AddRecipeButton                  src/components/AddRecipeButton.tsx
├── RecipeImportForm                 src/components/RecipeImportForm.tsx
├── RecipeList                       src/components/RecipeList.tsx
│   └── RecipeCard                   src/components/RecipeCard.tsx (existant)
├── useRecipeImport                  src/hooks/useRecipeImport.ts
├── recipeUrl / importedRecipe       src/lib/ (sans dépendance React ni API)
└── api.recipes.importFromUrl        src/api/client.ts
```

- **Séparation des responsabilités** : `RecipeImportForm` ne connaît ni l'API ni la navigation ; `useRecipeImport` porte l'état et les appels ; `src/lib/` contient la logique pure, testable sans DOM.
- **Rafraîchissement** : après un import réussi, un `reloadToken` relance `api.recipes.list(selectedTagNames)` au lieu d'insérer la recette dans l'état local. Une recette importée n'a pas de tag : si un filtre est actif, elle ne doit justement pas apparaître — le rechargement donne le bon résultat, une insertion optimiste non.
- **Accessibilité** : champ étiqueté, `aria-invalid`, `aria-describedby` vers l'aide ou l'erreur, erreur en `role="alert"`, succès en `role="status"`, `aria-busy` pendant le chargement, soumission par Entrée et annulation par Échap, focus porté sur le champ à l'ouverture.
- **Responsive** : le formulaire partage la barre d'en-tête sur grand écran (`flex: 1 1 340px`) et passe pleine largeur sous 560 px, où les deux boutons s'étirent.
- **QA** : attributs `data-qt-id` sur tous les éléments interactifs, convention `recipeLibrary__importForm_urlInput`. Les écrans plus anciens utilisent encore une convention kebab-case (`recipe-create-link`) ; les identifiants existants ont été conservés pour ne pas casser d'éventuels tests.
