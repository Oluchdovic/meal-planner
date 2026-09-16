import type { FastifyInstance } from 'fastify';
import { mkdirSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { join, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { ValidationError } from '../../shared/errors.js';
import { RecipesRepository } from './repository.js';
import { RecipeImportService } from './import/import-service.js';
import type { ImportRecipeRequest } from './import/types.js';
import type { RecipeInput } from './types.js';

interface RecipesRouteOptions {
  userId: number;
  photosDir: string;
}

const ALLOWED_PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export async function registerRecipeRoutes(
  app: FastifyInstance,
  options: RecipesRouteOptions
): Promise<void> {
  const repo = new RecipesRepository(app.db);
  const importService = new RecipeImportService();
  const { userId, photosDir } = options;

  app.get('/api/recipes', async (request) => {
    const query = request.query as { tags?: string };
    const tagNames = query.tags
      ? query.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    return repo.list(userId, tagNames);
  });

  app.get('/api/recipes/:id', async (request) => {
    const { id } = request.params as { id: string };
    return repo.getById(userId, Number(id));
  });

  app.post('/api/recipes', async (request, reply) => {
    const body = request.body as RecipeInput;
    const recipe = repo.create(userId, body);
    reply.code(201);
    return recipe;
  });

  /**
   * Extraction d'une recette depuis une URL publique. Ne persiste rien :
   * le client enchaîne sur `POST /api/recipes` avec les données retournées.
   */
  app.post('/api/recipes/import', async (request) => {
    const body = request.body as Partial<ImportRecipeRequest> | null;
    return importService.importFromUrl(body?.url);
  });

  app.put('/api/recipes/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as RecipeInput;
    return repo.update(userId, Number(id), body);
  });

  app.delete('/api/recipes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    repo.delete(userId, Number(id));
    reply.code(204);
    return null;
  });

  app.post('/api/recipes/:id/photo', async (request) => {
    const { id } = request.params as { id: string };
    const recipeId = Number(id);
    repo.getById(userId, recipeId); // ensures ownership / existence

    const file = await request.file();
    if (!file) {
      throw new ValidationError('Aucun fichier reçu');
    }

    const ext = extname(file.filename).toLowerCase();
    if (!ALLOWED_PHOTO_EXTENSIONS.has(ext)) {
      throw new ValidationError(`Extension de fichier non autorisée: ${ext}`);
    }

    mkdirSync(photosDir, { recursive: true });
    const fileName = `${randomUUID()}${ext}`;
    const destPath = join(photosDir, fileName);
    await pipeline(file.file, createWriteStream(destPath));

    return repo.setPhotoPath(userId, recipeId, fileName);
  });
}
