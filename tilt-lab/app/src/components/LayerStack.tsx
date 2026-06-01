import { useRef, useState } from 'react';
import type { LayerConfig, Manifest } from '../../../runtime/types';
import { ParamControls } from './ParamControls';
import { IconButton } from './IconButton';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  TrashIcon,
  GripVerticalIcon,
  EyeIcon,
  EyeOffIcon,
} from './icons';
import './LayerStack.css';

interface Props {
  layers: LayerConfig[];
  catalog: Manifest[];
  lastReason: string | null;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onParam: (index: number, key: string, value: unknown) => void;
  /** Optional - wired from the store by App. Until present, the enable toggle
   *  renders but is inert. See the cross-builder flag to the CD. */
  onSetEnabled?: (index: number, enabled: boolean) => void;
  /** Optional - wired from the store by App. Until present, the opacity slider
   *  renders but is inert. See the cross-builder flag to the CD. */
  onSetOpacity?: (index: number, opacity: number) => void;
}

interface ChannelCardProps {
  layer: LayerConfig;
  manifest: Manifest | undefined;
  name: string;
  /** The layer's index in the store's data array (paint order: 0 = bottommost). */
  index: number;
  /** This card's position in the DISPLAYED list (0 = top of the panel). */
  displayIndex: number;
  count: number;
  enabled: boolean;
  opacity: number;
  dragIndex: number | null;
  overIndex: number | null;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onParam: (index: number, key: string, value: unknown) => void;
  onSetEnabled?: (index: number, enabled: boolean) => void;
  onSetOpacity?: (index: number, opacity: number) => void;
  onHandleDown: (e: React.PointerEvent<HTMLElement>, displayIndex: number) => void;
  onHandleMove: (e: React.PointerEvent<HTMLElement>) => void;
  onHandleUp: (e: React.PointerEvent<HTMLElement>, displayIndex: number) => void;
}

/** A single channel strip. Owns its collapse state so default-expanded resets
 *  cleanly per render identity; reorder/remove keyboard paths stay in the parent. */
function ChannelCard({
  layer,
  manifest,
  name,
  index: i,
  displayIndex: d,
  count,
  enabled,
  opacity,
  dragIndex,
  overIndex,
  onRemove,
  onReorder,
  onParam,
  onSetEnabled,
  onSetOpacity,
  onHandleDown,
  onHandleMove,
  onHandleUp,
}: ChannelCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pct = Math.round(opacity * 100);
  // Click-to-type on the opacity percentage (parity with the param Slider readout).
  const [editingOpacity, setEditingOpacity] = useState(false);
  const [opacityDraft, setOpacityDraft] = useState('');
  const commitOpacity = () => {
    const parsed = Number(opacityDraft);
    if (Number.isFinite(parsed) && opacityDraft.trim() !== '') {
      onSetOpacity?.(i, Math.min(1, Math.max(0, parsed / 100)));
    }
    setEditingOpacity(false);
  };

  return (
    <li
      className="channel"
      data-enabled={enabled}
      data-collapsed={collapsed}
      data-dragging={dragIndex === d}
      data-drop-before={dragIndex !== null && dragIndex !== d && overIndex === d}
      data-drop-after={dragIndex !== null && d === count - 1 && overIndex === count}
    >
      <div className="channel__bar">
        <span
          className="channel__handle"
          role="button"
          aria-label={`Drag ${name} to reorder`}
          title="Drag to reorder"
          onPointerDown={(e) => onHandleDown(e, d)}
          onPointerMove={onHandleMove}
          onPointerUp={(e) => onHandleUp(e, d)}
        >
          <GripVerticalIcon className="channel__grip" width={14} height={14} />
        </span>
        <button
          type="button"
          className="channel__disclosure"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="channel__title">
            <span className="channel__name">{name}</span>
            <span className="channel__role meta" data-role={layer.layerRole}>
              {layer.layerRole}
            </span>
          </span>
          <ChevronDownIcon className="channel__chevron" width={14} height={14} aria-hidden="true" />
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="channel__opacity">
            <span className="channel__opacity-label meta">Opacity</span>
            <input
              className="channel__opacity-input"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={opacity}
              aria-label={`${name} opacity`}
              style={{ ['--channel-opacity-pct' as string]: `${pct}%` }}
              onChange={(e) => onSetOpacity?.(i, Number(e.target.value))}
            />
            {editingOpacity ? (
              <input
                className="channel__opacity-value value channel__opacity-edit"
                type="text"
                inputMode="numeric"
                aria-label={`${name} opacity percent`}
                autoFocus
                value={opacityDraft}
                onChange={(e) => setOpacityDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitOpacity();
                  else if (e.key === 'Escape') setEditingOpacity(false);
                }}
                onBlur={commitOpacity}
              />
            ) : (
              <output
                className="channel__opacity-value value channel__opacity-readout"
                title="Click to type a percentage"
                tabIndex={0}
                role="button"
                onClick={() => {
                  setOpacityDraft(String(pct));
                  setEditingOpacity(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpacityDraft(String(pct));
                    setEditingOpacity(true);
                  }
                }}
              >
                {pct}%
              </output>
            )}
          </div>

          <div className="channel__actions">
            <IconButton
              label={`Move ${name} up`}
              icon={<ChevronUpIcon />}
              disabled={d === 0}
              onClick={() => onReorder(i, i + 1)}
            />
            <IconButton
              label={`Move ${name} down`}
              icon={<ChevronDownIcon />}
              disabled={d === count - 1}
              onClick={() => onReorder(i, i - 1)}
            />
            <IconButton
              label={enabled ? `Hide ${name}` : `Show ${name}`}
              icon={enabled ? <EyeIcon /> : <EyeOffIcon />}
              onClick={() => onSetEnabled?.(i, !enabled)}
            />
            <IconButton
              label={`Remove ${name}`}
              icon={<TrashIcon />}
              onClick={() => onRemove(i)}
            />
          </div>

          {manifest?.interactions && manifest.interactions.length > 0 && (
            <div className="channel__interactions">
              <span className="channel__interactions-label meta">Interactions</span>
              <ul className="channel__interactions-list">
                {manifest.interactions.map((hint) => (
                  <li key={hint} className="channel__interaction">
                    {hint}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {manifest && manifest.params.length > 0 && (
            <ParamControls
              specs={manifest.params}
              values={layer.params}
              onChange={(key, value) => onParam(i, key, value)}
            />
          )}
        </>
      )}
    </li>
  );
}

export function LayerStack({
  layers,
  catalog,
  lastReason,
  onRemove,
  onReorder,
  onParam,
  onSetEnabled,
  onSetOpacity,
}: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  // Pointer-based drag reorder. dragIndex is the channel being dragged;
  // overIndex is the slot it would drop into (drives the drop-line affordance).
  // NOTE: both indices are DISPLAYED-list positions (0 = top of the panel),
  // which is the reverse of the store's paint-order array. We convert to store
  // indices only at the moment we call onReorder.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // The store array is paint order (index 0 = bottommost). The panel shows the
  // topmost layer first, so the displayed list is the array reversed. This maps
  // a displayed-list position back to its index in the store array.
  const toStoreIndex = (displayIndex: number): number => layers.length - 1 - displayIndex;

  const resetDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  // Map a pointer Y to the slot it sits over by measuring each channel's
  // mid-line. Returns 0..n (n == below the last channel).
  const slotForY = (clientY: number): number => {
    const list = listRef.current;
    if (!list) return 0;
    const items = Array.from(list.querySelectorAll<HTMLElement>('.channel'));
    for (let k = 0; k < items.length; k++) {
      const r = items[k].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return k;
    }
    return items.length;
  };

  const onHandleDown = (e: React.PointerEvent<HTMLElement>, i: number) => {
    e.preventDefault();
    setDragIndex(i);
    setOverIndex(i);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandleMove = (e: React.PointerEvent<HTMLElement>) => {
    if (dragIndex === null) return;
    const slot = slotForY(e.clientY);
    if (slot !== overIndex) setOverIndex(slot);
  };

  const onHandleUp = (e: React.PointerEvent<HTMLElement>, displayFrom: number) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (dragIndex !== null && overIndex !== null) {
      // Convert an insertion slot (0..n) into a displayed-list target position.
      const displayTo = displayFrom < overIndex ? overIndex - 1 : overIndex;
      const clampedDisplay = Math.max(0, Math.min(layers.length - 1, displayTo));
      if (clampedDisplay !== displayFrom) {
        // Both positions are displayed-list positions; map to store indices
        // (reverse of the array) before handing off to the store's reorder.
        onReorder(toStoreIndex(displayFrom), toStoreIndex(clampedDisplay));
      }
    }
    resetDrag();
  };

  return (
    <div className="layer-stack">
      <h2 className="layer-stack__title module__label">Composition</h2>
      {lastReason && (
        <p className="layer-stack__hint" role="alert">
          {lastReason}
        </p>
      )}
      {layers.length === 0 && (
        <p className="layer-stack__empty">Pick an effect to start a composition.</p>
      )}
      <ol className="layer-stack__list" ref={listRef}>
        {/* The panel shows the topmost layer first (Photoshop/Figma convention),
            so we walk the store's paint-order array in reverse. `d` is the
            displayed position; `i` is the layer's index in the store array. */}
        {layers
          .map((layer, i) => ({ layer, i }))
          .reverse()
          .map(({ layer, i }, d) => {
          const manifest = catalog.find((m) => m.id === layer.effectId);
          const name = manifest?.name ?? layer.effectId;
          const enabled = layer.enabled !== false;
          const opacity = layer.opacity ?? 1;
          return (
            <ChannelCard
              key={`${layer.effectId}-${i}`}
              layer={layer}
              manifest={manifest}
              name={name}
              index={i}
              displayIndex={d}
              count={layers.length}
              enabled={enabled}
              opacity={opacity}
              dragIndex={dragIndex}
              overIndex={overIndex}
              onRemove={onRemove}
              onReorder={onReorder}
              onParam={onParam}
              onSetEnabled={onSetEnabled}
              onSetOpacity={onSetOpacity}
              onHandleDown={onHandleDown}
              onHandleMove={onHandleMove}
              onHandleUp={onHandleUp}
            />
          );
        })}
      </ol>
    </div>
  );
}
