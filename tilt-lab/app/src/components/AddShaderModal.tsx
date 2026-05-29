import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { kind: 'glsl' | 'module' | 'url'; source: string }) => void;
}

export function AddShaderModal({ open, onClose, onSubmit }: Props) {
  const [kind, setKind] = useState<'glsl' | 'module' | 'url'>('glsl');
  const [source, setSource] = useState('');
  if (!open) return null;
  return (
    <div className="add-shader-modal" role="dialog" aria-label="Add shader">
      <div className="add-shader-modal__panel">
        <h2 className="add-shader-modal__title">Add a shader</h2>
        <div className="add-shader-modal__kinds">
          {(['glsl', 'module', 'url'] as const).map((k) => (
            <button key={k} data-active={kind === k} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
        <textarea
          aria-label="shader source"
          className="add-shader-modal__source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={kind === 'url' ? 'https://...' : 'paste source'}
        />
        <div className="add-shader-modal__actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => onSubmit({ kind, source })} disabled={!source.trim()}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
