import type { FastifyInstance } from 'fastify';
import { TagsRepository } from './repository.js';

interface TagsRouteOptions {
  userId: number;
}

export async function registerTagRoutes(
  app: FastifyInstance,
  options: TagsRouteOptions
): Promise<void> {
  const repo = new TagsRepository(app.db);
  const { userId } = options;

  app.get('/api/tags', async () => {
    return repo.list(userId);
  });

  app.post('/api/tags', async (request, reply) => {
    const body = request.body as { name: string };
    const tag = repo.create(userId, body.name);
    reply.code(201);
    return tag;
  });

  app.delete('/api/tags/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    repo.delete(userId, Number(id));
    reply.code(204);
    return null;
  });
}
