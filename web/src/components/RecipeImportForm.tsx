import { FormEvent, KeyboardEvent, useId, useMemo, useState } from 'react';
import { isValidRecipeUrl } from '../lib/recipeUrl';

interface RecipeImportFormProps {
  onSubmit: (url: string) => void;
  onCancel: () => void;
  loading?: boolean;
  /** Message d'erreur remonté par l'appel d'import. */
  error?: string | null;
  /** Efface l'erreur dès que l'utilisateur corrige sa saisie. */
  onDirty?: () => void;
}

/**
 * Formulaire inline de saisie d'URL. Purement présentationnel : il ne connaît
 * ni l'API ni le stockage, ce qui le rend testable sans réseau.
 */
export default function RecipeImportForm({
  onSubmit,
  onCancel,
  loading = false,
  error = null,
  onDirty,
}: RecipeImportFormProps) {
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);

  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  const isValid = useMemo(() => isValidRecipeUrl(url), [url]);
  const showFormatHint = touched && url.trim().length > 0 && !isValid;
  const canSubmit = isValid && !loading;

  function handleChange(value: string) {
    setUrl(value);
    if (error) onDirty?.();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(url);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape' && !loading) {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <form
      className="import-form"
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      noValidate
      aria-busy={loading}
      data-qt-id="recipeLibrary__importForm"
    >
      <div className="field import-form__field">
        <label htmlFor={fieldId}>URL de la recette à importer</label>
        <input
          id={fieldId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          // Le champ est la seule action du mode saisie : le focus lui revient.
          autoFocus
          placeholder="https://www.monsite.fr/recette/..."
          value={url}
          disabled={loading}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={showFormatHint || Boolean(error)}
          aria-describedby={error ? errorId : hintId}
          data-qt-id="recipeLibrary__importForm_urlInput"
        />
        <p className="import-form__hint" id={hintId}>
          {showFormatHint
            ? 'Adresse incomplète : indiquez une URL de page web, par exemple https://exemple.fr/ma-recette'
            : 'Le titre, le nombre de personnes, les ingrédients et les étapes seront récupérés automatiquement.'}
        </p>
      </div>

      {error && (
        <p className="banner-error" id={errorId} role="alert" data-qt-id="recipeLibrary__importForm_errorMessage">
          {error}
        </p>
      )}

      <div className="import-form__actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={loading}
          data-qt-id="recipeLibrary__importForm_cancelButton"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!canSubmit}
          data-qt-id="recipeLibrary__importForm_submitButton"
        >
          {loading ? 'Import en cours…' : 'Valider'}
        </button>
      </div>
    </form>
  );
}
