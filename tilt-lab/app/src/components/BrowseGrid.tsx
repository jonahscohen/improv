import { useState } from 'react';
import type { LayerRole, Manifest } from '../../../runtime/types';
import { filterCatalog } from '../state/catalog';
import { Select } from './controls';
import { ThumbnailPreview } from './ThumbnailPreview';
import './browse-grid.css';

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
    <div className="browse">
      <header className="browse__header">
        <span className="module__label">Browse</span>
        <span className="value browse__count">
          {shown.length} {shown.length === 1 ? 'effect' : 'effects'}
        </span>
      </header>

      <div className="browse__filters">
        <input
          className="field"
          placeholder="Search effects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          value={role ?? 'all'}
          options={['all', ...ROLES]}
          onChange={(v) => setRole(v === 'all' ? null : (v as LayerRole))}
          ariaLabel="Filter by role"
        />
      </div>

      {shown.length === 0 ? (
        <p className="browse__empty meta">No effects match.</p>
      ) : (
        <ul className="browse__grid">
          {shown.map((mft) => (
            <li key={mft.id} className="browse__cell">
              <button
                type="button"
                className="browse-card"
                onClick={() => onPick(mft)}
              >
                <ThumbnailPreview manifest={mft} />
                <span className="browse-card__name">{mft.name}</span>
                <span className="browse-card__role meta" data-role={mft.layerRole}>
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
