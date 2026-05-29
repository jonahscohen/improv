import { useState } from 'react';
import type { LayerRole, Manifest } from '../../../runtime/types';
import { filterCatalog } from '../state/catalog';

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
      <div className="browse-grid__filters">
        <input
          className="browse-grid__search"
          placeholder="Search effects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="browse-grid__roles">
          <button data-active={role === null} onClick={() => setRole(null)}>
            all
          </button>
          {ROLES.map((r) => (
            <button key={r} data-active={role === r} onClick={() => setRole(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
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
    </div>
  );
}
