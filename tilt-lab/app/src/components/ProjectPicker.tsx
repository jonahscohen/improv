interface Props {
  projects: string[];
  selected: string | null;
  onSelect: (project: string) => void;
}

export function ProjectPicker({ projects, selected, onSelect }: Props) {
  return (
    <label className="project-picker">
      <span className="project-picker__label">Project</span>
      <select
        aria-label="target project"
        value={selected ?? ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>
          {projects.length ? 'Select a project' : 'No projects (server offline)'}
        </option>
        {projects.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}
