import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RecipeImportForm from './RecipeImportForm';

const VALID_URL = 'https://www.exemple.fr/recette/lasagnes';

type FormProps = Parameters<typeof RecipeImportForm>[0];

function renderForm(overrides: Partial<FormProps> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(<RecipeImportForm onSubmit={onSubmit} onCancel={onCancel} {...overrides} />);

  return {
    onSubmit,
    onCancel,
    input: screen.getByLabelText(/URL de la recette/i) as HTMLInputElement,
    submit: screen.getByRole('button', { name: /Valider|Import en cours/i }) as HTMLButtonElement,
    cancel: screen.getByRole('button', { name: /Annuler/i }) as HTMLButtonElement,
  };
}

describe('RecipeImportForm', () => {
  it('désactive Valider tant que l’URL est vide', () => {
    expect(renderForm().submit.disabled).toBe(true);
  });

  it('laisse Valider désactivé pour une URL invalide', async () => {
    const { input, submit } = renderForm();
    await userEvent.type(input, 'pas une url');
    expect(submit.disabled).toBe(true);
  });

  it('active Valider pour une URL valide et transmet la saisie', async () => {
    const { input, submit, onSubmit } = renderForm();

    await userEvent.type(input, VALID_URL);
    expect(submit.disabled).toBe(false);

    await userEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith(VALID_URL);
  });

  it('soumet aussi avec la touche Entrée', async () => {
    const { input, onSubmit } = renderForm();
    await userEvent.type(input, `${VALID_URL}{Enter}`);
    expect(onSubmit).toHaveBeenCalledWith(VALID_URL);
  });

  it('affiche une aide au format après une saisie invalide quittée', async () => {
    const { input } = renderForm();
    await userEvent.type(input, 'exemple');
    await userEvent.tab();

    expect(screen.getByText(/Adresse incomplète/i)).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('appelle onCancel depuis le bouton Annuler et la touche Échap', async () => {
    const { cancel, input, onCancel } = renderForm();

    await userEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);

    await userEvent.type(input, '{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('expose l’erreur d’import comme alerte accessible', () => {
    renderForm({ error: 'Le site exemple.fr est inaccessible' });
    expect(screen.getByRole('alert').textContent).toBe('Le site exemple.fr est inaccessible');
  });

  it('efface l’erreur dès que la saisie change', async () => {
    const onDirty = vi.fn();
    const { input } = renderForm({ error: 'Erreur précédente', onDirty });

    await userEvent.type(input, 'h');
    expect(onDirty).toHaveBeenCalled();
  });

  it('verrouille le formulaire pendant le chargement', () => {
    const { input, submit, cancel } = renderForm({ loading: true });

    expect(input.disabled).toBe(true);
    expect(submit.disabled).toBe(true);
    expect(cancel.disabled).toBe(true);
    expect(submit.textContent).toContain('Import en cours');
  });
});
