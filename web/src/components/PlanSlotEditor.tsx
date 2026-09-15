import { useState } from 'react';
import type { PlanSlot, Recipe } from '../api/types';

interface PlanSlotEditorProps {
  slot: PlanSlot;
  recipes: Recipe[];
  onChange: (input: { recipeId: number | null; servingsOverride: number | null }) => void;
}

export default function PlanSlotEditor({ slot, recipes, onChange }: PlanSlotEditorProps) {
  const [overrideDraft, setOverrideDraft] = useState(
    slot.servingsOverride != null ? String(slot.servingsOverride) : ''
  );

  const recipe = recipes.find((r) => r.id === slot.recipeId) ?? null;

  function handleRecipeChange(value: string) {
    const recipeId = value ? Number(value) : null;
    onChange({ recipeId, servingsOverride: recipeId ? slot.servingsOverride : null });
    if (!recipeId) setOverrideDraft('');
  }

  function commitOverride() {
    const parsed = overrideDraft.trim() === '' ? null : Number(overrideDraft);
    onChange({ recipeId: slot.recipeId, servingsOverride: Number.isFinite(parsed as number) ? parsed : null });
  }

  return (
    <div className="plan-slot" data-qt-id={`plan-slot-${slot.id}`}>
      <select
        value={slot.recipeId ?? ''}
        onChange={(e) => handleRecipeChange(e.target.value)}
        data-qt-id={`plan-slot-select-${slot.id}`}
        aria-label="Recette assignée"
      >
        <option value="">— vide —</option>
        {recipes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
      </select>

      {slot.recipeId && (
        <div className="plan-slot__override">
          <span>Portions</span>
          <input
            type="number"
            min={0}
            step="0.5"
            placeholder={String(recipe?.servings ?? '')}
            value={overrideDraft}
            onChange={(e) => setOverrideDraft(e.target.value)}
            onBlur={commitOverride}
            data-qt-id={`plan-slot-override-${slot.id}`}
            aria-label="Portions personnalisées pour ce créneau"
          />
        </div>
      )}
    </div>
  );
}
