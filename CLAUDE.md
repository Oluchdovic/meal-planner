# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mijoté — a single-user (mono-utilisateur) meal-planning app: a tagged recipe library, meal plans (date × meal-type grid), and an auto-generated shopping list. Full spec in [SPEC.md](./SPEC.md); user-facing docs in [README.md](./README.md). UI text and API error messages are in French.

Data model already carries a `user_id` on every table (single seeded user, no auth/login in V1) so a future multi-user pass needs only an auth layer, not a schema migration. Recipe import from a URL was added after V1 (see `src/modules/recipes/import/`), so SPEC.md's "hors scope" list is annotated rather than authoritative on that point. Still out of scope: nutrition/calories, real auth, native mobile, server-side PDF export, automatic plan generation (the `constraint_tags` column on `plan_slots` is a reserved extension point, unused by any algorithm today).

## Commands

Yarn workspaces monorepo (`server/`, `web/`), single `yarn.lock` at the root.

```bash
yarn install                              # installs both workspaces
yarn dev                                  # API (:3000) + web (:5173) concurrently, from repo root

yarn workspace meal-planner-server dev    # API only, tsx watch
yarn workspace meal-planner-web dev       # web only, Vite dev server (proxies /api and /photos to :3000)

yarn workspace meal-planner-server build  # tsc -> server/dist
yarn workspace meal-planner-server start  # node dist/server.js — serves API + static web/dist build on :3000
yarn workspace meal-planner-web build     # tsc -b && vite build -> web/dist

yarn workspace meal-planner-server typecheck   # tsc --noEmit
yarn workspace meal-planner-web typecheck      # tsc --noEmit
yarn typecheck                                 # both workspaces, from repo root

yarn test                                      # both workspaces, from repo root
yarn workspace meal-planner-server test        # vitest run (node env)
yarn workspace meal-planner-web test           # vitest run (jsdom + Testing Library)
```

Tests are Vitest, colocated as `*.test.ts(x)` next to the code. Server tests are excluded from `tsc` (see `server/tsconfig.json`) so they never land in `dist/`; web tests are type-checked with the rest of `web/src`. Server imports use explicit `.js` extensions, so `server/vitest.config.ts` aliases them back to the `.ts` sources.

There is no lint config in either workspace — do not assume a `lint` script exists.

```bash
docker compose -f docker/docker-compose.yml up --build   # single container, serves on :3000, mounts ./data
```

Backend env vars (all optional, see [README.md](./README.md) for the full table): `PORT`, `HOST`, `DATA_DIR`, `DB_PATH`, `PHOTOS_DIR`, `WEB_DIST_DIR`.

## Architecture

### Backend (`server/`)

Fastify + TypeScript, ESM (`"type": "module"`, NodeNext resolution — internal imports use explicit `.js` extensions even though the source is `.ts`). `better-sqlite3` for synchronous SQLite access; no ORM.

- `src/server.ts` — bootstraps Fastify: opens the DB, seeds the single user, registers CORS/multipart, registers each module's routes, mounts `/photos/` as static files from `PHOTOS_DIR`, and serves the built web app (`WEB_DIST_DIR`) with an SPA fallback to `index.html` for any non-`/api` path.
- `src/db/client.ts` — opens the SQLite file (WAL mode, foreign keys on) and runs versioned SQL migrations from `migrations/*.sql` sequentially on boot, tracked in a `schema_migrations` table. Add new migrations as new numbered `.sql` files here; there is no ORM-driven migration DSL.
- `src/db/seed.ts` — creates the single default user on first boot if none exists.
- `src/modules/<name>/` — one folder per domain (`recipes`, `tags`, `plans`, `shopping-list`), each with `routes.ts` (Fastify route registration, `register*Routes(app, options)`), `repository.ts` (SQL queries against `app.db`, the decorated `better-sqlite3` instance), and `types.ts` where relevant. `shopping-list` has no routes file of its own — it's computed on demand from a plan via `compute.ts`, aggregating `recipe_ingredients` across `plan_slots`, scaled by `servings_override / recipe.servings` and summed by `(normalized name, unit)`. There is no dedicated shopping-list table.
- `src/modules/recipes/import/` — URL recipe import behind `POST /api/recipes/import`. One file per concern: `page-fetcher.ts` (URL validation + SSRF guard + bounded fetch), `schemaorg-parser.ts` (JSON-LD then microdata), `fallback-parser.ts` (HTML heuristic), `recipe-parser.ts` (normalization to the closed unit enum), `import-service.ts` (orchestration, takes an injectable `PageFetcher` so tests run offline), `html.ts` (dependency-free HTML helpers). The endpoint extracts only — it persists nothing; the client re-posts to `POST /api/recipes`. Full rationale and limitations in [docs/recipe-import.md](./docs/recipe-import.md).
- `src/shared/errors.ts` — `HttpError` and its subclasses (`NotFoundError`, `ValidationError`, `UnprocessableEntityError`, `BadGatewayError`, `GatewayTimeoutError`); the global error handler in `server.ts` maps these to their status code and passes anything else through as a 500.
- `src/shared/units.ts` — the closed enum of ingredient units (`UNITS`/`Unit`/`isUnit`), mirrored by a SQL `CHECK` constraint on `recipe_ingredients.unit`. Extend both the TS enum and the DB constraint together if a unit is added.
- Every route handler takes the seeded `userId` from its module's options rather than from a session — there's no per-request auth context yet.
- Recipe photo uploads go through `@fastify/multipart`, are extension-allowlisted, written to `PHOTOS_DIR` under a random UUID filename, and referenced by that relative filename in `recipes.photo_path`.

### Frontend (`web/`)

React + TypeScript + Vite, React Router for client-side routing.

- `src/App.tsx` — top-level route table (recipe library/form, meal planning, plan list/detail, shopping list).
- `src/api/client.ts` — the single typed fetch client (`api.recipes.*`, `api.tags.*`, `api.plans.*`); all requests go through `request<T>()` which prefixes `/api`, JSON-encodes bodies (except `FormData`), and throws `ApiError` on non-OK responses. `src/api/types.ts` holds the matching request/response types — keep these in sync with the server's `modules/*/types.ts` shapes when the API changes.
- `src/pages/` — route-level screens; `src/components/` — presentational/composed pieces used by them (e.g. `PlanningView`/`PlanningDayCard`/`PlanningHeader` compose the meal-planning grid; `PlanSlotEditor` handles assigning a recipe to a slot).
- `src/hooks/` — stateful logic extracted from pages (e.g. `useRecipeImport` drives the two-step import → create sequence, owning its loading/error state).
- `src/lib/` — framework-free helpers (date handling, planning-period math, recipe-URL validation, imported-recipe mapping) with no API or React dependency.
- In dev, Vite proxies `/api` and `/photos` to the backend on `:3000` (see [README.md](./README.md)); in production the backend serves the built `web/dist` directly, so both live under one origin and one port.

### React/perf guidelines

`.agents/skills/vercel-react-best-practices/` contains a Vercel-maintained set of React/Next.js performance rules (waterfalls, bundle size, re-renders, etc.) in `AGENTS.md` and `rules/*.md`. Consult it when writing or reviewing non-trivial frontend code — most of it (re-render, rendering, JS-performance categories) applies directly even though this is a Vite SPA rather than Next.js; the Next-specific/server-component rules (`bundle-dynamic-imports` via `next/dynamic`, `server-*`, RSC-related `advanced-*`) don't apply here.
