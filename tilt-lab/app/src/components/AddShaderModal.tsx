import { useEffect, useRef, useState } from 'react';
import './add-shader-modal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { kind: 'glsl' | 'module' | 'url'; source: string }) => void;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function AddShaderModal({ open, onClose, onSubmit }: Props) {
  const [kind, setKind] = useState<'glsl' | 'module' | 'url'>('glsl');
  const [source, setSource] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const firstControlRef = useRef<HTMLButtonElement>(null);

  // Autofocus the first control when the modal opens.
  useEffect(() => {
    if (open) firstControlRef.current?.focus();
  }, [open]);

  // Escape closes; Tab is trapped within the panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="add-shader-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Add shader"
      onClick={onClose}
    >
      <div
        className="add-shader-modal__panel"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="add-shader-modal__title">Add a shader</h2>
        <span className="meta">Type</span>
        <div className="add-shader-modal__kinds">
          {(['glsl', 'module', 'url'] as const).map((k, i) => (
            <button
              key={k}
              className="add-shader-modal__kind"
              ref={i === 0 ? firstControlRef : undefined}
              data-active={kind === k}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <span className="meta">Source</span>
        <textarea
          aria-label="shader source"
          className="add-shader-modal__source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={kind === 'url' ? 'https://...' : 'paste source'}
        />
        <div className="add-shader-modal__actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--accent"
            onClick={() => onSubmit({ kind, source })}
            disabled={!source.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
