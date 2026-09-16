# Spécification — Application de planification de repas (V1)

## 1. Vision

Application web permettant de :
1. Maintenir une bibliothèque de recettes taguées (contraintes libres : saison, régime, durée...).
2. Construire des plans de repas sur une période choisie, en assignant manuellement des recettes filtrées par tags à des créneaux (date + type de repas).
3. Générer automatiquement une liste de courses agrégée à partir d'un plan.

Mono-utilisateur en V1 (pas d'authentification), mais le modèle de données porte déjà la notion d'utilisateur pour permettre un passage au multi-utilisateur sans réécriture du schéma.

**Hors scope V1** (explicitement reporté) :
- Nutrition / calories.
- ~~Import de recettes depuis des sites externes (scraping).~~ **Livré après la V1** : import depuis une URL via les données structurées Schema.org, avec replis microdata et heuristique. Voir [docs/recipe-import.md](./docs/recipe-import.md).
- Authentification et gestion réelle de plusieurs utilisateurs (la table `users` existe, mais un seul utilisateur est créé au démarrage, sans login).
- Application mobile native.
- Export / impression PDF (une vue imprimable simple via le navigateur peut suffire si besoin, mais aucune génération de PDF côté serveur).
- Génération automatique de plan (moteur de règles). Le modèle prévoit un point d'extension (`constraint_tags` sur les créneaux) mais aucun algorithme n'est implémenté en V1 — le remplissage reste 100% manuel.

## 2. Stack technique

- **Backend** : Node.js + TypeScript, framework HTTP léger (Fastify recommandé), `better-sqlite3` pour l'accès à SQLite (API synchrone, simple, pas d'ORM lourd nécessaire pour ce périmètre).
- **Frontend** : React + TypeScript (Vite), servi comme build statique par le backend ou séparément derrière un reverse proxy.
- **Base de données** : SQLite, fichier unique monté en volume Docker (`data/app.db`).
- **Photos** : stockées sur disque, dans un dossier monté en volume Docker (`data/photos/`), référencées par chemin relatif en base.
- **Déploiement** : un conteneur Docker unique (backend + build frontend servi statiquement), avec un `docker-compose.yml` montant deux volumes (`data/app.db`, `data/photos/`). Portable sur VPS, NAS, ou tout hôte Docker.
- **Migrations** : fichiers SQL versionnés exécutés séquentiellement au démarrage du serveur (pas d'ORM à migrations magiques — traçabilité simple et explicite).
- **Auth** : aucune en V1 (application supposée déployée sur un réseau de confiance ou derrière une protection réseau — VPN/reverse proxy — gérée hors de l'application elle-même). À noter comme point d'attention opérationnel si l'URL est exposée publiquement sans protection.

## 3. Modèle de données

### `users`
| champ | type | notes |
|---|---|---|
| id | INTEGER PK | |
| email | TEXT UNIQUE | |
| display_name | TEXT | |
| created_at | TEXT (ISO 8601) | |

Un seul enregistrement est créé automatiquement au premier démarrage (seed). Toutes les autres tables référencent `user_id` dès la V1 pour éviter une migration de données lors du passage multi-utilisateur — seule l'ajout d'une couche d'authentification/session sera nécessaire plus tard.

### `recipes`
| champ | type | notes |
|---|---|---|
| id | INTEGER PK | |
| user_id | INTEGER FK → users | |
| title | TEXT NOT NULL | |
| servings | REAL NOT NULL | nombre de portions de base de la recette |
| prep_time_minutes | INTEGER NULL | |
| cook_time_minutes | INTEGER NULL | |
| instructions | TEXT (JSON) | tableau ordonné d'étapes (`string[]`) |
| photo_path | TEXT NULL | chemin relatif dans `data/photos/` |
| created_at | TEXT | |
| updated_at | TEXT | |

### `recipe_ingredients`
| champ | type | notes |
|---|---|---|
| id | INTEGER PK | |
| recipe_id | INTEGER FK → recipes | |
| name | TEXT NOT NULL | ex. "farine" |
| quantity | REAL NOT NULL | relative à `recipes.servings` |
| unit | TEXT NOT NULL | valeur contrainte, voir liste ci-dessous |
| sort_order | INTEGER | ordre d'affichage |

**Liste fermée des unités** (`unit`, contrainte CHECK en base + enum côté TS) :
`g`, `kg`, `ml`, `l`, `unite`, `cas` (cuillère à soupe), `cac` (cuillère à café), `pincee`, `tranche`, `botte`, `gousse`, `sachet`.
(Liste ajustable — mais fermée pour garantir une agrégation fiable dans la liste de courses.)

### `tags`
| champ | type | notes |
|---|---|---|
| id | INTEGER PK | |
| user_id | INTEGER FK → users | tags scopés par utilisateur, cohérent avec le multi-utilisateur futur |
| name | TEXT NOT NULL | unique par `user_id` |

Pas de catégorisation : tags libres et plats (ex. "été", "rapide", "végétarien"), créés à la volée depuis l'UI de gestion des recettes.

### `recipe_tags` (table de jointure)
| champ | type |
|---|---|
| recipe_id | INTEGER FK → recipes |
| tag_id | INTEGER FK → tags |

Clé primaire composite `(recipe_id, tag_id)`.

### `meal_plans`
| champ | type | notes |
|---|---|---|
| id | INTEGER PK | |
| user_id | INTEGER FK → users | |
| name | TEXT NULL | ex. "Semaine du 8 sept." |
| start_date | TEXT (date ISO) | |
| end_date | TEXT (date ISO) | |
| created_at | TEXT | |

Période libre : l'utilisateur choisit `start_date`/`end_date` à la création (pas de contrainte "semaine" ou "mois").

### `plan_slots`
| champ | type | notes |
|---|---|---|
| id | INTEGER PK | |
| plan_id | INTEGER FK → meal_plans | |
| date | TEXT (date ISO) | doit être dans `[start_date, end_date]` du plan |
| meal_type | TEXT | enum : `breakfast`, `lunch`, `dinner`, `snack` |
| recipe_id | INTEGER FK → recipes NULL | nullable : un créneau peut rester vide |
| servings_override | REAL NULL | si renseigné, remplace `recipe.servings` pour le calcul de la liste de courses de ce créneau |
| constraint_tags | TEXT (JSON) NULL | tableau d'IDs de tags — **non exploité par un algorithme en V1** (remplissage manuel uniquement), mais persisté pour éviter une migration de schéma quand la génération automatique sera implémentée |

Une même recette peut apparaître dans plusieurs `plan_slots` du même plan (pas de contrainte d'unicité).

### Liste de courses

Pas de table dédiée en V1 : la liste de courses est **calculée à la demande** à partir d'un `plan_id` :
1. Pour chaque `plan_slot` ayant un `recipe_id` non nul, récupérer les `recipe_ingredients`.
2. Appliquer le facteur d'échelle `servings_override / recipe.servings` (ou `1` si `servings_override` est nul) à chaque quantité.
3. Agréger par clé `(name normalisé, unit)` en sommant les quantités.
4. Retourner la liste triée (alphabétique par nom).

Si le besoin de persister/historiser des listes de courses apparaît plus tard, une table `shopping_lists` pourra être ajoutée sans impact sur le modèle existant.

## 4. Structure du projet

```
meal-planner/
├── SPEC.md
├── README.md
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── data/                        # volumes Docker (gitignored)
│   ├── app.db
│   └── photos/
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   └── ...
│   └── src/
│       ├── server.ts            # bootstrap Fastify + migrations au démarrage
│       ├── db/
│       │   ├── client.ts        # ouverture better-sqlite3 + run migrations
│       │   └── seed.ts          # crée l'utilisateur unique si absent
│       ├── modules/
│       │   ├── recipes/
│       │   │   ├── routes.ts
│       │   │   ├── repository.ts
│       │   │   └── types.ts
│       │   ├── tags/
│       │   │   ├── routes.ts
│       │   │   └── repository.ts
│       │   ├── plans/
│       │   │   ├── routes.ts
│       │   │   ├── repository.ts
│       │   │   └── types.ts
│       │   └── shopping-list/
│       │       ├── routes.ts
│       │       └── compute.ts   # logique d'agrégation
│       └── shared/
│           ├── units.ts         # enum des unités fermées
│           └── errors.ts
└── web/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── api/                 # client fetch typé vers le backend
        ├── pages/
        │   ├── RecipeLibraryPage.tsx
        │   ├── RecipeFormPage.tsx
        │   ├── PlanListPage.tsx
        │   ├── PlanDetailPage.tsx    # grille date × meal_type, assignation recettes
        │   └── ShoppingListPage.tsx
        └── components/
            ├── TagFilterBar.tsx
            ├── RecipeCard.tsx
            └── PlanSlotEditor.tsx
```

## 5. API (aperçu fonctionnel, non exhaustif)

- `GET/POST /api/recipes`, `GET/PUT/DELETE /api/recipes/:id` — CRUD recettes (ingrédients inclus en sous-ressource dans le payload).
- `GET/POST /api/tags` — gestion des tags (création à la volée).
- `GET /api/recipes?tags=ete,rapide` — filtrage bibliothèque par tags.
- `GET/POST /api/plans`, `GET/PUT/DELETE /api/plans/:id` — CRUD plans.
- `PUT /api/plans/:id/slots/:slotId` — assigner/retirer une recette à un créneau, ajuster `servings_override`.
- `GET /api/plans/:id/shopping-list` — liste de courses agrégée calculée à la demande.
- `POST /api/recipes/:id/photo` — upload de la photo (stockage disque).

## 6. Scénario de vérification bout-en-bout (V1 "terminée")

1. Créer 5 recettes avec ingrédients structurés (nom + quantité + unité), instructions en étapes, portions de base, et une photo chacune ; leur assigner des tags variés (ex. "été", "rapide", "végétarien", "hiver").
2. Créer un plan de repas sur une période libre de 4 jours.
3. Filtrer la bibliothèque par tag "rapide", assigner une recette à un créneau dîner, puis réutiliser la **même recette** sur un autre créneau du plan.
4. Sur un des créneaux, définir un `servings_override` différent des portions de base de la recette.
5. Générer la liste de courses du plan : vérifier que les quantités du créneau ajusté sont recalculées proportionnellement, et que les ingrédients identiques (même nom + même unité) provenant de plusieurs créneaux sont bien sommés en une seule ligne.
6. Vérifier qu'un créneau laissé vide (`recipe_id` nul) n'apparaît pas dans la liste de courses et n'empêche pas la génération.

Si ces six étapes produisent le résultat attendu, la V1 est considérée fonctionnellement complète.
