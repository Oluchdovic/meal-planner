import type {
  ImportedRecipe,
  MealPlan,
  MealPlanInput,
  PlanSlot,
  PlanSlotInput,
  Recipe,
  RecipeInput,
  ShoppingListItem,
  Tag,
} from './types';

class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore JSON parse failure, keep default message
    }
    throw new ApiError(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  recipes: {
    list: (tags: string[] = []) =>
      request<Recipe[]>(`/recipes${tags.length ? `?tags=${tags.map(encodeURIComponent).join(',')}` : ''}`),
    get: (id: number) => request<Recipe>(`/recipes/${id}`),
    create: (input: RecipeInput) =>
      request<Recipe>('/recipes', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: number, input: RecipeInput) =>
      request<Recipe>(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    delete: (id: number) => request<void>(`/recipes/${id}`, { method: 'DELETE' }),
    /** Extrait une recette depuis une URL publique, sans l'enregistrer. */
    importFromUrl: (url: string) =>
      request<ImportedRecipe>('/recipes/import', { method: 'POST', body: JSON.stringify({ url }) }),
    uploadPhoto: (id: number, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<Recipe>(`/recipes/${id}/photo`, { method: 'POST', body: form });
    },
  },
  tags: {
    list: () => request<Tag[]>('/tags'),
    create: (name: string) =>
      request<Tag>('/tags', { method: 'POST', body: JSON.stringify({ name }) }),
    delete: (id: number) => request<void>(`/tags/${id}`, { method: 'DELETE' }),
  },
  plans: {
    list: () => request<MealPlan[]>('/plans'),
    get: (id: number) => request<MealPlan>(`/plans/${id}`),
    create: (input: MealPlanInput) =>
      request<MealPlan>('/plans', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: number, input: MealPlanInput) =>
      request<MealPlan>(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    delete: (id: number) => request<void>(`/plans/${id}`, { method: 'DELETE' }),
    updateSlot: (planId: number, slotId: number, input: PlanSlotInput) =>
      request<PlanSlot>(`/plans/${planId}/slots/${slotId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    shoppingList: (planId: number) =>
      request<ShoppingListItem[]>(`/plans/${planId}/shopping-list`),
  },
};

export { ApiError };
