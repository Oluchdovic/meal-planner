import type { FastifyInstance } from 'fastify';
import { PlansRepository } from './repository.js';
import { computeShoppingList } from '../shopping-list/compute.js';
import type { MealPlanInput, PlanSlotInput } from './types.js';

interface PlansRouteOptions {
  userId: number;
}

export async function registerPlanRoutes(
  app: FastifyInstance,
  options: PlansRouteOptions
): Promise<void> {
  const repo = new PlansRepository(app.db);
  const { userId } = options;

  app.get('/api/plans', async () => {
    return repo.list(userId);
  });

  app.get('/api/plans/:id', async (request) => {
    const { id } = request.params as { id: string };
    return repo.getById(userId, Number(id));
  });

  app.post('/api/plans', async (request, reply) => {
    const body = request.body as MealPlanInput;
    const plan = repo.create(userId, body);
    reply.code(201);
    return plan;
  });

  app.put('/api/plans/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as MealPlanInput;
    return repo.update(userId, Number(id), body);
  });

  app.delete('/api/plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    repo.delete(userId, Number(id));
    reply.code(204);
    return null;
  });

  app.put('/api/plans/:id/slots/:slotId', async (request) => {
    const { id, slotId } = request.params as { id: string; slotId: string };
    const body = request.body as PlanSlotInput;
    return repo.updateSlot(userId, Number(id), Number(slotId), body);
  });

  app.get('/api/plans/:id/shopping-list', async (request) => {
    const { id } = request.params as { id: string };
    const plan = repo.getById(userId, Number(id));
    return computeShoppingList(app.db, plan);
  });
}
