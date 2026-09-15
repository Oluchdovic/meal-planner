# Mijoté — planificateur de repas

Application mono-utilisateur de planification de repas : bibliothèque de recettes taguées, plans de repas (grille date × type de repas), et liste de courses générée automatiquement. Voir [SPEC.md](./SPEC.md) pour la spécification complète.

## Stack

- **Backend** : Fastify + TypeScript + `better-sqlite3`, migrations SQL versionnées.
- **Frontend** : React + TypeScript (Vite).
- **Base de données** : SQLite (fichier unique), photos stockées sur disque.

## Développement local

Le projet est un monorepo Yarn workspaces (`server/`, `web/`). Tout lancer en une seule commande depuis la racine (via `concurrently`) :

```bash
yarn install   # installe les dépendances de server/ et web/ (un seul yarn.lock à la racine)
yarn dev       # lance l'API (:3000) et le frontend (:5173) en parallèle
```

Ou séparément, dans deux terminaux :

```bash
# Terminal 1 — API (http://localhost:3000)
yarn workspace meal-planner-server dev

# Terminal 2 — Frontend (http://localhost:5173, proxy /api et /photos vers :3000)
yarn workspace meal-planner-web dev
```

Au premier démarrage du serveur, les migrations SQL (`server/migrations/`) sont appliquées automatiquement et un utilisateur unique est créé (`data/app.db`). Les photos uploadées sont stockées dans `data/photos/`.

Ouvrir http://localhost:5173.

## Build de production

```bash
yarn workspace meal-planner-server build   # server/dist
yarn workspace meal-planner-web build      # web/dist
yarn workspace meal-planner-server start   # sert l'API + le build statique du frontend sur le port 3000
```

## Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```

Monte `./data` en volume (`data/app.db`, `data/photos/`), exposé sur le port 3000.

## Variables d'environnement (backend)

| variable | défaut | usage |
|---|---|---|
| `PORT` | `3000` | port d'écoute |
| `HOST` | `0.0.0.0` | interface d'écoute |
| `DATA_DIR` | `./data` | racine des données (db + photos) |
| `DB_PATH` | `${DATA_DIR}/app.db` | chemin du fichier SQLite |
| `PHOTOS_DIR` | `${DATA_DIR}/photos` | dossier de stockage des photos |
| `WEB_DIST_DIR` | `../web/dist` | build statique du frontend à servir |
