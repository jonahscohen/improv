import { useState } from 'react';
import type { LayerRole, Manifest } from '../../../runtime/types';
import { filterCatalog } from '../state/catalog';
import { Select } from './controls';

interface Props {
  catalog: Manifest[];
  onPick: (manifest: Manifest) => void;
}

const ROLES: LayerRole[] = ['background', 'midground', 'pointer', 'post'];

export function BrowseGrid({ catalog, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<LayerRole | null>(null);
  const shown = filterCatalog(catalog, { query, role });

  return (
    <div className="browse-grid">
      <header className="browse-grid__header">
        <h2 className="browse-grid__title">Browse</h2>
        <span className="browse-grid__count">
          {shown.length} {shown.length === 1 ? 'effect' : 'effects'}
        </span>
      </header>
      <div className="browse-grid__filters">
        <input
          className="browse-grid__search"
          placeholder="Search effects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="browse-grid__roles">
          <Select
            value={role ?? 'all'}
            options={['all', ...ROLES]}
            onChange={(v) => setRole(v === 'all' ? null : (v as LayerRole))}
            ariaLabel="Filter by role"
          />
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="browse-grid__empty">No effects match.</p>
      ) : (
        <ul className="browse-grid__cards">
          {shown.map((mft) => (
            <li key={mft.id}>
              <button className="browse-grid__card" onClick={() => onPick(mft)}>
                <span className="browse-grid__card-name">{mft.name}</span>
                <span className="browse-grid__card-role" data-role={mft.layerRole}>
                  {mft.layerRole}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
