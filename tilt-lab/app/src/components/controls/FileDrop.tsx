import { useState } from 'react';
import './FileDrop.css';

export interface FileDropProps {
  onChange: (objectUrl: string) => void;
  ariaLabel: string;
  accept?: string;
  fileName?: string;
  /** Hint shown in the empty drop zone (e.g. "color image", "depth map"). */
  placeholder?: string;
}

/**
 * FileDrop - a drag-and-drop zone wrapping a native file input. Preserves the
 * URL.createObjectURL(file) -> onChange flow and the image/video accept set.
 * The native input stays in the tree (visually hidden, still focusable) so the
 * control is keyboard operable and click-to-browse works.
 */
export function FileDrop({ onChange, ariaLabel, accept = 'image/*,video/*', fileName, placeholder }: FileDropProps) {
  const [name, setName] = useState<string | null>(fileName ?? null);
  const [dragging, setDragging] = useState(false);

  const accept_ = (file: File | undefined | null) => {
    if (!file) return;
    setName(file.name);
    onChange(URL.createObjectURL(file));
  };

  return (
    <label
      className="tl-filedrop"
      data-dragging={dragging}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept_(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        className="tl-filedrop__input"
        type="file"
        aria-label={ariaLabel}
        accept={accept}
        onChange={(e) => accept_(e.target.files?.[0])}
      />
      <span className="tl-filedrop__text">
        {name ? name : placeholder ? `Drop ${placeholder} or click` : 'Drop image / video or click'}
      </span>
    </label>
  );
}
