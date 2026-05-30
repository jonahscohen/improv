import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { loadCatalog } from './state/catalog';
import { createStackStore } from './state/stackStore';
import { BrowseGrid } from './components/BrowseGrid';
import { PreviewCanvas } from './components/PreviewCanvas';
import { LayerStack } from './components/LayerStack';
import { TopBar } from './components/TopBar';
import { AddShaderModal } from './components/AddShaderModal';
import { Tooltip } from './components/Tooltip';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MaximizeIcon,
  MinimizeIcon,
} from './components/icons';

// Floating instrument controls sit over the preview stage so they stay reachable
// in every shell state (including fullscreen, where the topbar and rails are gone).
const CONTROL_GLYPH = { width: 18, height: 18 } as const;

export function App() {
  const catalog = useMemo(() => loadCatalog(), []);
  const store = useMemo(() => createStackStore(), []);
  const layers = useSyncExternalStore(store.subscribe, store.layers, store.layers);
  const [reason, setReason] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [project, setProject] = useState<string | null>(null);

  const [railLeftCollapsed, setRailLeftCollapsed] = useState(false);
  const [railRightCollapsed, setRailRightCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Esc exits fullscreen (the one global shortcut the instrument owns).
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  return (
    <div className="app" data-fullscreen={fullscreen ? 'true' : undefined}>
      <TopBar
        projects={[]}
        selectedProject={project}
        onSelectProject={setProject}
        onAddShader={() => setModalOpen(true)}
        layers={layers}
      />
      <main
        className="app__body"
        data-rail-left={railLeftCollapsed ? 'collapsed' : undefined}
        data-rail-right={railRightCollapsed ? 'collapsed' : undefined}
      >
        <aside className="app__browse">
          <BrowseGrid
            catalog={catalog}
            onPick={(m) => {
              const res = store.add(m);
              setReason(res.ok ? null : (res.reason ?? 'Cannot add layer.'));
            }}
          />
        </aside>
        <section className="app__preview">
          <PreviewCanvas layers={layers} />
          {layers.length === 0 && (
            <div className="app__preview-empty" aria-hidden="true">
              <p>
                <strong>Live preview</strong>
                Pick an effect from the left to arm a stack. What renders here is
                exactly what exports.
              </p>
            </div>
          )}

          {!fullscreen && (
            // Positioning lives on the wrapper, not the button, so the Tooltip's
            // trigger span measures the button at its real on-screen spot.
            <div
              style={{
                position: 'absolute',
                top: 'var(--sp-bar)',
                left: 'var(--sp-bar)',
                zIndex: 5,
              }}
            >
              <Tooltip
                label={
                  railLeftCollapsed ? 'Expand browse rail' : 'Collapse browse rail'
                }
                placement="bottom"
              >
                <button
                  type="button"
                  className="icon-btn"
                  style={{ background: 'var(--surface-1)' }}
                  aria-label={
                    railLeftCollapsed ? 'Expand browse rail' : 'Collapse browse rail'
                  }
                  aria-pressed={railLeftCollapsed}
                  onClick={() => setRailLeftCollapsed((v) => !v)}
                >
                  {railLeftCollapsed ? (
                    <ChevronRightIcon {...CONTROL_GLYPH} />
                  ) : (
                    <ChevronLeftIcon {...CONTROL_GLYPH} />
                  )}
                </button>
              </Tooltip>
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              top: 'var(--sp-bar)',
              right: 'var(--sp-bar)',
              zIndex: 5,
              display: 'flex',
              gap: 'var(--sp-xs)',
            }}
          >
            {!fullscreen && (
              <Tooltip
                label={
                  railRightCollapsed ? 'Expand layers rail' : 'Collapse layers rail'
                }
                placement="bottom"
              >
                <button
                  type="button"
                  className="icon-btn"
                  style={{ background: 'var(--surface-1)' }}
                  aria-label={
                    railRightCollapsed
                      ? 'Expand layers rail'
                      : 'Collapse layers rail'
                  }
                  aria-pressed={railRightCollapsed}
                  onClick={() => setRailRightCollapsed((v) => !v)}
                >
                  {railRightCollapsed ? (
                    <ChevronLeftIcon {...CONTROL_GLYPH} />
                  ) : (
                    <ChevronRightIcon {...CONTROL_GLYPH} />
                  )}
                </button>
              </Tooltip>
            )}
            <Tooltip
              label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              placement="bottom"
            >
              <button
                type="button"
                className="icon-btn"
                style={{ background: 'var(--surface-1)' }}
                aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                aria-pressed={fullscreen}
                onClick={() => setFullscreen((v) => !v)}
              >
                {fullscreen ? (
                  <MinimizeIcon {...CONTROL_GLYPH} />
                ) : (
                  <MaximizeIcon {...CONTROL_GLYPH} />
                )}
              </button>
            </Tooltip>
          </div>
        </section>
        <aside className="app__layers">
          <LayerStack
            layers={layers}
            catalog={catalog}
            lastReason={reason}
            onRemove={store.remove}
            onReorder={store.reorder}
            onParam={store.setParam}
            onSetEnabled={(i, e) => store.setEnabled(i, e)}
            onSetOpacity={(i, o) => store.setOpacity(i, o)}
          />
        </aside>
      </main>
      <AddShaderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={() => setModalOpen(false) /* save wired in Plan 4 */}
      />
    </div>
  );
}
