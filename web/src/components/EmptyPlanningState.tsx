interface EmptyPlanningStateProps {
  onPlanAutomatically: () => void;
}

export default function EmptyPlanningState({ onPlanAutomatically }: EmptyPlanningStateProps) {
  return (
    <div className="empty-state" data-qt-id="planning-empty-state">
      <h3>Aucun repas planifié sur cette période.</h3>
      <p>Lancez une planification automatique pour remplir cette période en un clic.</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onPlanAutomatically}
        data-qt-id="planning-empty-auto-plan-button"
      >
        Planifier mes repas
      </button>
    </div>
  );
}
