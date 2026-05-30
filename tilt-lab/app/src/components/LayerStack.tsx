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
  index: number;
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
  onHandleDown: (e: React.PointerEvent<HTMLElement>, i: number) => void;
  onHandleMove: (e: React.PointerEvent<HTMLElement>) => void;
  onHandleUp: (e: React.PointerEvent<HTMLElement>, i: number) => void;
}

/** A single channel strip. Owns its collapse state so default-expanded resets
 *  cleanly per render identity; reorder/remove keyboard paths stay in the parent. */
function ChannelCard({
  layer,
  manifest,
  name,
  index: i,
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

  return (
    <li
      className="channel"
      data-enabled={enabled}
      data-collapsed={collapsed}
      data-dragging={dragIndex === i}
      data-drop-before={dragIndex !== null && dragIndex !== i && overIndex === i}
      data-drop-after={dragIndex !== null && i === count - 1 && overIndex === count}
    >
      <div className="channel__bar">
        <span
          className="channel__handle"
          role="button"
          aria-label={`Drag ${name} to reorder`}
          title="Drag to reorder"
          onPointerDown={(e) => onHandleDown(e, i)}
          onPointerMove={onHandleMove}
          onPointerUp={(e) => onHandleUp(e, i)}
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
            <output className="channel__opacity-value value">{pct}%</output>
          </div>

          <div className="channel__actions">
            <IconButton
              label={`Move ${name} up`}
              icon={<ChevronUpIcon />}
              disabled={i === 0}
              onClick={() => onReorder(i, i - 1)}
            />
            <IconButton
              label={`Move ${name} down`}
              icon={<ChevronDownIcon />}
              disabled={i === count - 1}
              onClick={() => onReorder(i, i + 1)}
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

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

  const onHandleUp = (e: React.PointerEvent<HTMLElement>, i: number) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (dragIndex !== null && overIndex !== null) {
      // Convert an insertion slot (0..n) into the store's target index.
      const to = i < overIndex ? overIndex - 1 : overIndex;
      const clamped = Math.max(0, Math.min(layers.length - 1, to));
      if (clamped !== i) onReorder(i, clamped);
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
        {layers.map((layer, i) => {
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
