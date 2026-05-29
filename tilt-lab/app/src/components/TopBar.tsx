import { ProjectPicker } from './ProjectPicker';

interface Props {
  projects: string[];
  selectedProject: string | null;
  onSelectProject: (project: string) => void;
  onSend: () => void;
  onAddShader: () => void;
  canSend: boolean;
}

export function TopBar({
  projects,
  selectedProject,
  onSelectProject,
  onSend,
  onAddShader,
  canSend,
}: Props) {
  return (
    <header className="top-bar">
      <span className="top-bar__brand">tilt-lab</span>
      <ProjectPicker projects={projects} selected={selectedProject} onSelect={onSelectProject} />
      <span className="top-bar__spacer" />
      <button className="top-bar__add" onClick={onAddShader}>
        Add shader
      </button>
      <button className="top-bar__send" onClick={onSend} disabled={!canSend}>
        Send to project
      </button>
    </header>
  );
}
