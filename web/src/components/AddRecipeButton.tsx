interface AddRecipeButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  dataQtId?: string;
}

/** Déclencheur du mode « saisie d'URL » de la bibliothèque de recettes. */
export default function AddRecipeButton({
  onClick,
  disabled = false,
  label = 'Ajouter une recette',
  dataQtId = 'recipeLibrary__toolbar_addRecipeButton',
}: AddRecipeButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={onClick}
      disabled={disabled}
      data-qt-id={dataQtId}
    >
      {label}
    </button>
  );
}
