import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db/client.js';
import { seedDefaultUser } from './db/seed.js';
import { HttpError } from './shared/errors.js';
import { registerRecipeRoutes } from './modules/recipes/routes.js';
import { registerTagRoutes } from './modules/tags/routes.js';
import { registerPlanRoutes } from './modules/plans/routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR = process.env.DATA_DIR ?? join(__dirname, '..', '..', 'data');
const DB_PATH = process.env.DB_PATH ?? join(DATA_DIR, 'app.db');
const PHOTOS_DIR = process.env.PHOTOS_DIR ?? join(DATA_DIR, 'photos');
const WEB_DIST_DIR = process.env.WEB_DIST_DIR ?? join(__dirname, '..', '..', 'web', 'dist');
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main() {
  const app = Fastify({ logger: true });

  const db = openDatabase(DB_PATH);
  app.decorate('db', db);
  const userId = seedDefaultUser(db);

  await app.register(cors, { origin: true });
  await app.register(multipart);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.code(error.statusCode).send({ error: error.message });
      return;
    }
    app.log.error(error);
    reply.code(500).send({ error: 'Erreur interne du serveur' });
  });

  await registerRecipeRoutes(app, { userId, photosDir: PHOTOS_DIR });
  await registerTagRoutes(app, { userId });
  await registerPlanRoutes(app, { userId });

  await app.register(fastifyStatic, {
    root: PHOTOS_DIR,
    prefix: '/photos/',
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: WEB_DIST_DIR,
    prefix: '/',
    decorateReply: true,
    wildcard: false,
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.raw.url?.startsWith('/api/')) {
      reply.code(404).send({ error: 'Route API introuvable' });
      return;
    }
    reply.type('text/html').sendFile('index.html');
  });

  await app.listen({ port: PORT, host: HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
