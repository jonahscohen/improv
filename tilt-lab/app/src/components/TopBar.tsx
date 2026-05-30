import { useRef, useState } from 'react';
import type { LayerConfig } from '../../../runtime/types';
import { ProjectPicker } from './ProjectPicker';
import { Tooltip } from './Tooltip';
import { PlusIcon, DownloadIcon, CopyIcon, CheckIcon } from './icons';
import { downloadStackConfig, copyStackConfig } from '../lib/export';

interface Props {
  projects: string[];
  selectedProject: string | null;
  onSelectProject: (project: string) => void;
  onAddShader: () => void;
  /**
   * The current layer stack. Drives server-free export (download / copy config).
   * Optional during the App rewire; export controls disable until layers exist.
   */
  layers?: LayerConfig[];
  /** @deprecated legacy server-handoff path; superseded by server-free export. */
  onSend?: () => void;
  /** @deprecated legacy server-handoff gate; superseded by `layers`. */
  canSend?: boolean;
}

const ACTION_GLYPH = { width: 18, height: 18 } as const;

export function TopBar({
  projects,
  selectedProject,
  onSelectProject,
  onAddShader,
  layers = [],
}: Props) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canExport = layers.length > 0;
  const disabledTitle = 'Add a layer to the stack to export';

  const handleCopy = () => {
    copyStackConfig(layers)
      .then(() => {
        setCopied(true);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {
        /* clipboard denied; leave the label unchanged */
      });
  };

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <img className="top-bar__logo" src="/and-dev-white.svg" alt="and dev" />
        <span className="top-bar__brand">tilt-lab</span>
      </div>

      <ProjectPicker projects={projects} selected={selectedProject} onSelect={onSelectProject} />

      <div className="top-bar__right">
        <Tooltip label="Add shader" placement="bottom">
          <button
            type="button"
            className="icon-btn"
            onClick={onAddShader}
            aria-label="Add shader"
          >
            <PlusIcon {...ACTION_GLYPH} />
          </button>
        </Tooltip>
        {/* Disabled export buttons keep their explanatory tooltip: a disabled
            <button> swallows no pointer events, so the Tooltip wrapper span
            (not the button) carries the hover and still surfaces the reason. */}
        <Tooltip
          label={canExport ? 'Download the stack as a config JSON' : disabledTitle}
          placement="bottom"
        >
          <button
            type="button"
            className="icon-btn"
            onClick={() => downloadStackConfig(layers)}
            disabled={!canExport}
            aria-label="Download config"
          >
            <DownloadIcon {...ACTION_GLYPH} />
          </button>
        </Tooltip>
        <Tooltip
          label={canExport ? 'Copy the stack config JSON to the clipboard' : disabledTitle}
          placement="bottom"
        >
          <button
            type="button"
            className="icon-btn"
            onClick={handleCopy}
            disabled={!canExport}
            aria-label={copied ? 'Copied' : 'Copy config'}
          >
            {copied ? <CheckIcon {...ACTION_GLYPH} /> : <CopyIcon {...ACTION_GLYPH} />}
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
