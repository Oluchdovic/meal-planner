import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { UNIT_LABELS, UNITS } from '../api/types';
import type { RecipeIngredientInput, Tag, Unit } from '../api/types';

interface IngredientDraft {
  key: string;
  name: string;
  quantity: string;
  unit: Unit;
}

let draftKeySeq = 0;
function newDraftKey() {
  draftKeySeq += 1;
  return `ing-${draftKeySeq}`;
}

export default function RecipeFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [servings, setServings] = useState('4');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    { key: newDraftKey(), name: '', quantity: '', unit: 'g' },
  ]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEditing);

  useEffect(() => {
    api.tags.list().then(setAllTags).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    api.recipes
      .get(Number(id))
      .then((recipe) => {
        setTitle(recipe.title);
        setServings(String(recipe.servings));
        setPrepTime(recipe.prepTimeMinutes != null ? String(recipe.prepTimeMinutes) : '');
        setCookTime(recipe.cookTimeMinutes != null ? String(recipe.cookTimeMinutes) : '');
        setSteps(recipe.instructions.length > 0 ? recipe.instructions : ['']);
        setIngredients(
          recipe.ingredients.length > 0
            ? recipe.ingredients.map((ing) => ({
                key: newDraftKey(),
                name: ing.name,
                quantity: String(ing.quantity),
                unit: ing.unit,
              }))
            : [{ key: newDraftKey(), name: '', quantity: '', unit: 'g' }]
        );
        setSelectedTagIds(recipe.tags.map((t) => t.id));
        setPhotoPath(recipe.photoPath);
        setLoaded(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Recette introuvable'));
  }, [id, isEditing]);

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, '']);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function updateIngredient(key: string, patch: Partial<IngredientDraft>) {
    setIngredients((prev) => prev.map((ing) => (ing.key === key ? { ...ing, ...patch } : ing)));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { key: newDraftKey(), name: '', quantity: '', unit: 'g' }]);
  }

  function removeIngredient(key: string) {
    setIngredients((prev) => prev.filter((ing) => ing.key !== key));
  }

  function toggleTag(tagId: number) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  }

  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const tag = await api.tags.create(name);
      setAllTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
      setSelectedTagIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]));
      setNewTagName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer ce tag');
    }
  }

  async function handlePhotoChange(file: File | null) {
    if (!file || !isEditing) return;
    try {
      const recipe = await api.recipes.uploadPhoto(Number(id), file);
      setPhotoPath(recipe.photoPath);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'envoi de la photo");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedIngredients: RecipeIngredientInput[] = [];
    for (const ing of ingredients) {
      if (!ing.name.trim()) continue;
      const quantity = Number(ing.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError(`Quantité invalide pour l'ingrédient "${ing.name}"`);
        return;
      }
      parsedIngredients.push({ name: ing.name.trim(), quantity, unit: ing.unit });
    }

    const servingsNumber = Number(servings);
    if (!Number.isFinite(servingsNumber) || servingsNumber <= 0) {
      setError('Le nombre de portions doit être un nombre positif');
      return;
    }

    const payload = {
      title: title.trim(),
      servings: servingsNumber,
      prepTimeMinutes: prepTime.trim() ? Number(prepTime) : null,
      cookTimeMinutes: cookTime.trim() ? Number(cookTime) : null,
      instructions: steps.map((s) => s.trim()).filter(Boolean),
      ingredients: parsedIngredients,
      tagIds: selectedTagIds,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await api.recipes.update(Number(id), payload);
      } else {
        const created = await api.recipes.create(payload);
        navigate(`/recipes/${created.id}/edit`, { replace: true });
        setSaving(false);
        return;
      }
      navigate('/recipes');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEditing) return;
    if (!window.confirm('Supprimer définitivement cette recette ?')) return;
    try {
      await api.recipes.delete(Number(id));
      navigate('/recipes');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de la suppression');
    }
  }

  if (!loaded) {
    return <p className="loading-hint">Chargement de la recette…</p>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <h1>{isEditing ? 'Modifier la recette' : 'Nouvelle recette'}</h1>
          <p>Renseignez les ingrédients avec une unité fermée pour une liste de courses fiable.</p>
        </div>
        {isEditing && (
          <button type="button" className="btn btn-danger" onClick={handleDelete} data-qt-id="recipe-delete-button">
            Supprimer
          </button>
        )}
      </div>

      {error && <div className="banner-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          {isEditing && (
            <div className="photo-upload">
              <div
                className="photo-upload__preview"
                style={photoPath ? { backgroundImage: `url(/photos/${photoPath})` } : undefined}
              />
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="photo-input">Photo de la recette</label>
                <input
                  id="photo-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                  data-qt-id="recipe-photo-input"
                />
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="title">Titre</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              data-qt-id="recipe-title-input"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="servings">Portions de base</label>
              <input
                id="servings"
                type="number"
                min={0.5}
                step="0.5"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                required
                data-qt-id="recipe-servings-input"
              />
            </div>
            <div className="field">
              <label htmlFor="prep-time">Préparation (min)</label>
              <input
                id="prep-time"
                type="number"
                min={0}
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                data-qt-id="recipe-prep-time-input"
              />
            </div>
            <div className="field">
              <label htmlFor="cook-time">Cuisson (min)</label>
              <input
                id="cook-time"
                type="number"
                min={0}
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                data-qt-id="recipe-cook-time-input"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head">
            <h3>Ingrédients</h3>
            <button type="button" className="btn btn-secondary" onClick={addIngredient} data-qt-id="recipe-add-ingredient">
              Ajouter un ingrédient
            </button>
          </div>
          {ingredients.map((ing) => (
            <div className="ingredient-row" key={ing.key}>
              <input
                placeholder="Nom (ex. farine)"
                value={ing.name}
                onChange={(e) => updateIngredient(ing.key, { name: e.target.value })}
                data-qt-id={`ingredient-name-${ing.key}`}
                aria-label="Nom de l'ingrédient"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Quantité"
                value={ing.quantity}
                onChange={(e) => updateIngredient(ing.key, { quantity: e.target.value })}
                data-qt-id={`ingredient-quantity-${ing.key}`}
                aria-label="Quantité"
              />
              <select
                value={ing.unit}
                onChange={(e) => updateIngredient(ing.key, { unit: e.target.value as Unit })}
                data-qt-id={`ingredient-unit-${ing.key}`}
                aria-label="Unité"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => removeIngredient(ing.key)}
                data-qt-id={`ingredient-remove-${ing.key}`}
                aria-label="Retirer l'ingrédient"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>

        <div className="form-section">
          <div className="form-section__head">
            <h3>Étapes</h3>
            <button type="button" className="btn btn-secondary" onClick={addStep} data-qt-id="recipe-add-step">
              Ajouter une étape
            </button>
          </div>
          {steps.map((step, index) => (
            <div className="step-row" key={index}>
              <span className="step-row__number">{index + 1}.</span>
              <textarea
                value={step}
                onChange={(e) => updateStep(index, e.target.value)}
                placeholder="Décrire l'étape"
                data-qt-id={`recipe-step-${index}`}
                aria-label={`Étape ${index + 1}`}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => removeStep(index)}
                data-qt-id={`recipe-step-remove-${index}`}
                aria-label="Retirer l'étape"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>

        <div className="form-section">
          <h3>Tags</h3>
          <div className="tag-row" style={{ marginBottom: '0.8rem' }}>
            {allTags.map((tag) => {
              const isActive = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-chip tag-chip--button${isActive ? ' tag-chip--active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => toggleTag(tag.id)}
                  data-qt-id={`recipe-tag-toggle-${tag.id}`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
          <div className="field-row">
            <div className="field" style={{ maxWidth: 240 }}>
              <label htmlFor="new-tag">Créer un tag</label>
              <input
                id="new-tag"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
                placeholder="ex. été"
                data-qt-id="recipe-new-tag-input"
              />
            </div>
            <button type="button" className="btn btn-secondary" onClick={handleCreateTag} data-qt-id="recipe-new-tag-submit">
              Ajouter le tag
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving} data-qt-id="recipe-save-button">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/recipes')} data-qt-id="recipe-cancel-button">
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
