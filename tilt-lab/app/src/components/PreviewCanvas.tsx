import { useEffect, useRef } from 'react';
import { Compositor } from '../../../runtime/compositor';
import { effectFactories } from '../../../runtime/index';
import type { Effect, LayerConfig } from '../../../runtime/types';

interface Props {
  layers: LayerConfig[];
}

export function PreviewCanvas({ layers }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const compRef = useRef<Compositor | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!hostRef.current) return;
    const comp = new Compositor(hostRef.current, (id): Effect => {
      const factory = effectFactories[id];
      if (!factory) throw new Error(`unknown effect id: ${id}`);
      return factory();
    });
    compRef.current = comp;
    const loop = (t: number) => {
      comp.renderFrame(t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      comp.clear();
    };
  }, []);

  useEffect(() => {
    compRef.current?.setLayers(layers);
  }, [layers]);

  return (
    <div
      className="preview-canvas"
      ref={hostRef}
      role="img"
      aria-label="Live preview of the composited visual effect layers"
    />
  );
}
