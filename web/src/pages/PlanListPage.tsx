import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { MealPlan } from '../api/types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function PlanListPage() {
  const [plans, setPlans] = useState<MealPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(addDaysIso(todayIso(), 3));
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  function refresh() {
    api.plans
      .list()
      .then(setPlans)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement des plans'));
  }

  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const plan = await api.plans.create({ name: name.trim() || null, startDate, endDate });
      navigate(`/plans/${plan.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de la création du plan');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <h1>Plans de repas</h1>
          <p>Construisez un plan sur la période de votre choix, puis assignez vos recettes.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)} data-qt-id="plan-create-open">
          Nouveau plan
        </button>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {plans === null && <p className="loading-hint">Chargement des plans…</p>}

      {plans && plans.length === 0 && (
        <div className="empty-state">
          <h3>Aucun plan pour l’instant</h3>
          <p>Créez un plan de repas pour commencer à assigner des recettes à vos créneaux.</p>
        </div>
      )}

      {plans && plans.length > 0 && (
        <div className="plan-list">
          {plans.map((plan) => (
            <Link key={plan.id} to={`/plans/${plan.id}`} className="card plan-row" data-qt-id={`plan-row-${plan.id}`}>
              <div>
                <div className="plan-row__title">{plan.name || `Plan du ${plan.startDate}`}</div>
                <div className="plan-row__dates">
                  {plan.startDate} → {plan.endDate}
                </div>
              </div>
              <span className="meta-pill">{plan.slots.filter((s) => s.recipeId).length} créneaux remplis</span>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nouveau plan de repas</h3>
            <form onSubmit={handleCreate}>
              <div className="field">
                <label htmlFor="plan-name">Nom (optionnel)</label>
                <input
                  id="plan-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex. Semaine du 8 sept."
                  data-qt-id="plan-name-input"
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="plan-start">Début</label>
                  <input
                    id="plan-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    data-qt-id="plan-start-input"
                  />
                </div>
                <div className="field">
                  <label htmlFor="plan-end">Fin</label>
                  <input
                    id="plan-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    data-qt-id="plan-end-input"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.4rem' }}>
                <button type="submit" className="btn btn-primary" disabled={creating} data-qt-id="plan-create-submit">
                  {creating ? 'Création…' : 'Créer le plan'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} data-qt-id="plan-create-cancel">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
