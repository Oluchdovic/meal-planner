import type { Tag } from '../api/types';

interface TagFilterBarProps {
  tags: Tag[];
  selected: number[];
  onToggle: (tagId: number) => void;
}

export default function TagFilterBar({ tags, selected, onToggle }: TagFilterBarProps) {
  if (tags.length === 0) return null;

  return (
    <div className="tag-row" role="group" aria-label="Filtrer par tag">
      {tags.map((tag) => {
        const isActive = selected.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            className={`tag-chip tag-chip--button${isActive ? ' tag-chip--active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onToggle(tag.id)}
            data-qt-id={`tag-filter-${tag.id}`}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
