import { useMemo, useState } from 'react';

export interface Option {
  key: string;
  label: string;
}

const SHOWN = 60;

/** Type to filter, then pick. Matches the label or the key. */
export function SearchSelect(props: {
  label: string;
  options: readonly Option[];
  value: string | null;
  onChange: (key: string | null) => void;
  allowNone?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const current = props.options.find((option) => option.key === props.value);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = needle
      ? props.options.filter((option) => option.label.toLowerCase().includes(needle) || option.key === needle)
      : props.options;
    return found.slice(0, SHOWN);
  }, [props.options, query]);

  function pick(key: string | null) {
    props.onChange(key);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="search">
      <span>{props.label}</span>
      <span className="search-box">
        <input
          aria-label={props.label}
          value={open ? query : current?.label ?? (props.value === null ? '' : `#${props.value}`)}
          placeholder={props.placeholder ?? 'Search'}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && matches[0]) {
              event.preventDefault();
              pick(matches[0].key);
            }
            if (event.key === 'Escape') (event.target as HTMLInputElement).blur();
          }}
        />
        {props.allowNone && props.value !== null && (
          <button type="button" className="search-clear" aria-label={`Clear ${props.label}`} onClick={() => pick(null)}>
            ×
          </button>
        )}
      </span>
      {open && (
        <ul className="search-list">
          {matches.map((option) => (
            <li key={option.key}>
              <button
                type="button"
                className={option.key === props.value ? 'chosen' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(option.key)}
              >
                {option.label}
              </button>
            </li>
          ))}
          {!matches.length && <li className="search-empty">No match</li>}
        </ul>
      )}
    </div>
  );
}

/** Options for an id/name resource list, labelled "Name (id)". */
export function namedOptions(rows: readonly { id: number; name: string }[]): Option[] {
  return rows.map((row) => ({ key: String(row.id), label: `${row.name || 'unnamed'} (${row.id})` }));
}
