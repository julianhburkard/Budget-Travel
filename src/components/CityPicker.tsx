import { useId, useMemo, useState } from 'react';
import { locationLabel, searchLocations, type PerDiemLocation } from '../lib/perDiem';

interface Props {
  locations: PerDiemLocation[];
  selectedLabel: string;
  onSelect: (loc: PerDiemLocation) => void;
  onClear: () => void;
}

/** Searchable city box: type to filter, arrows + Enter or click to pick. */
export function CityPicker({ locations, selectedLabel, onSelect, onClear }: Props) {
  const [query, setQuery] = useState<string | null>(null); // null = not editing, show the selection
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => (query ? searchLocations(locations, query) : []), [locations, query]);
  const open = query !== null && query.trim() !== '';

  const pick = (loc: PerDiemLocation) => {
    onSelect(loc);
    setQuery(null);
  };

  return (
    <div className="city-picker">
      <input
        className="text city-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Destination city"
        placeholder="Search a city or country…"
        value={query ?? selectedLabel}
        onFocus={(e) => {
          setQuery('');
          setActive(0);
          e.target.select();
        }}
        onBlur={() => setQuery(null)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            pick(results[active]);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {selectedLabel && query === null && (
        <button className="icon-btn city-clear" aria-label="Clear destination" title="Clear destination" onClick={onClear}>
          ×
        </button>
      )}
      {open && (
        <ul className="city-results" id={listId} role="listbox">
          {results.length === 0 && <li className="city-empty muted small">No match. Try the country or state name to find "Other locations in …".</li>}
          {results.map((loc, i) => (
            <li
              key={loc.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              // mousedown (not click) so it fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                pick(loc);
                (document.activeElement as HTMLElement | null)?.blur();
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{locationLabel(loc)}</span>
              {loc.area && <span className="muted small">{loc.area}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
