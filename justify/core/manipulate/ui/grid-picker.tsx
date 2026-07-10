/**
 * GridPicker - visual grid size selector for CSS grid.
 * Rested: compact preview with "N x M" label.
 * Expanded: 10x10 picker dialog - hover to preview, click to select.
 * Generates grid-template-columns/rows as repeat(N, 1fr).
 *
 * Ported verbatim from Retune overlay/src/ui/grid-picker.tsx.
 * The selected/preview cell tints derive from the marker color (see the
 * .retune-grid-picker-cell rules in controls.css, now var(--justify-marker,
 * #D97757) based) so they follow the user-selected marker live; the #eeeceb
 * hover tint stays neutral.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useScrollLock } from "./use-scroll-lock";

const MAX_COLS = 10;
const MAX_ROWS = 10;

// Multiplication sign (U+00D7), matching Retune's "N x M" label verbatim.
const TIMES = "×";

export interface GridPickerProps {
  columns: number;
  rows: number;
  onChange: (prop: string, value: string) => void;
}

function parseGridCount(template: string | undefined): number {
  if (!template || template === "none") return 0;
  const repeatMatch = template.match(/repeat\((\d+)/);
  if (repeatMatch) return parseInt(repeatMatch[1], 10);
  const tracks = template.trim().split(/\s+/).filter((t) => t && t !== "none");
  return tracks.length;
}

export { parseGridCount };

export function GridPicker({ columns, rows, onChange }: GridPickerProps) {
  const [open, setOpen] = useState(false);
  const [hoverCol, setHoverCol] = useState<number>(0);
  const [hoverRow, setHoverRow] = useState<number>(0);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useScrollLock(open);

  const displayCols = Math.max(1, columns || 1);
  const displayRows = Math.max(1, rows || 1);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      if (!e.composedPath().includes(container)) {
        setOpen(false);
      }
    };
    const root = containerRef.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("pointerdown", handlePointerDown as EventListener);
    return () => root.removeEventListener("pointerdown", handlePointerDown as EventListener);
  }, [open]);

  const handleSelect = useCallback(() => {
    if (hoverCol > 0 && hoverRow > 0) {
      onChange("gridTemplateColumns", `repeat(${hoverCol}, 1fr)`);
      onChange("gridTemplateRows", `repeat(${hoverRow}, 1fr)`);
      setOpen(false);
    }
  }, [hoverCol, hoverRow, onChange]);

  const previewCols = isHovering ? hoverCol : columns;
  const previewRows = isHovering ? hoverRow : rows;

  return (
    <div className="retune-grid-picker-wrap" ref={containerRef}>
      {/* Rested state: compact preview */}
      <button
        type="button"
        className="retune-grid-picker-preview"
        onClick={() => setOpen(!open)}
        aria-label={`Grid: ${displayCols} ${TIMES} ${displayRows}`}
      >
        <div
          className="retune-grid-picker-mini"
          style={{
            gridTemplateColumns: `repeat(${displayCols}, 1fr)`,
            gridTemplateRows: `repeat(${displayRows}, 1fr)`,
          }}
        >
          {Array.from({ length: displayCols * displayRows }, (_, i) => (
            <div key={i} className="retune-grid-picker-mini-cell" />
          ))}
          <span className="retune-grid-picker-label">{displayCols} {TIMES} {displayRows}</span>
        </div>
      </button>

      {/* Expanded state: picker dialog */}
      {open && (
        <div className="retune-grid-picker-dialog">
          <div className="retune-grid-picker-dialog-header">
            {previewCols > 0 && previewRows > 0
              ? `${previewCols} ${TIMES} ${previewRows}`
              : "Select grid size"}
          </div>
          <div
            className="retune-grid-picker-grid"
            onMouseLeave={() => setIsHovering(false)}
            onClick={handleSelect}
          >
            {Array.from({ length: MAX_ROWS }, (_, r) =>
              Array.from({ length: MAX_COLS }, (_, c) => {
                const col = c + 1;
                const row = r + 1;
                const isSelected = !isHovering && col <= columns && row <= rows;
                const isPreview = isHovering && col <= hoverCol && row <= hoverRow;
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`retune-grid-picker-cell${isSelected ? " selected" : ""}${isPreview ? " preview" : ""}`}
                    onMouseEnter={() => {
                      setIsHovering(true);
                      setHoverCol(col);
                      setHoverRow(row);
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
