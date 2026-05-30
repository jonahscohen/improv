import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, CheckIcon } from './icons';
import './ProjectPicker.css';

interface Props {
  projects: string[];
  selected: string | null;
  onSelect: (project: string) => void;
}

/**
 * Project target as a contextual menu: a centered trigger button shows the
 * current target (or the offline state) and opens a popover list of projects.
 * The server handoff is offline, so with no projects the menu shows a single
 * disabled state line. Closes on outside-click and Escape. It never gates
 * export (which is server-free).
 */
export function ProjectPicker({ projects, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = selected ?? (projects.length ? 'Select project' : 'No project');

  // Outside-click + Escape close the menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="project-menu" ref={rootRef}>
      <button
        type="button"
        className="project-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="project-menu__meta meta">Project</span>
        <span className="project-menu__current">{label}</span>
        <ChevronDownIcon className="project-menu__caret" width={14} height={14} />
      </button>

      {open && (
        <div className="project-menu__popover" role="menu">
          {projects.length === 0 ? (
            <p className="project-menu__empty" role="presentation">
              No projects (server offline)
            </p>
          ) : (
            projects.map((p) => (
              <button
                key={p}
                type="button"
                role="menuitemradio"
                aria-checked={p === selected}
                className="project-menu__item"
                onClick={() => {
                  onSelect(p);
                  setOpen(false);
                }}
              >
                <span className="project-menu__item-name">{p}</span>
                {p === selected && (
                  <CheckIcon className="project-menu__item-check" width={14} height={14} />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
