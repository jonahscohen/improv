import { useMemo, useState, useSyncExternalStore } from 'react';
import { loadCatalog } from './state/catalog';
import { createStackStore } from './state/stackStore';
import { BrowseGrid } from './components/BrowseGrid';
import { PreviewCanvas } from './components/PreviewCanvas';
import { LayerStack } from './components/LayerStack';
import { TopBar } from './components/TopBar';
import { AddShaderModal } from './components/AddShaderModal';

export function App() {
  const catalog = useMemo(() => loadCatalog(), []);
  const store = useMemo(() => createStackStore(), []);
  const layers = useSyncExternalStore(store.subscribe, store.layers, store.layers);
  const [reason, setReason] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [project, setProject] = useState<string | null>(null);

  return (
    <div className="app">
      <TopBar
        projects={[]}
        selectedProject={project}
        onSelectProject={setProject}
        onSend={() => {
          /* wired in Plan 4 (server + handoff) */
        }}
        onAddShader={() => setModalOpen(true)}
        canSend={!!project && layers.length > 0}
      />
      <main className="app__body">
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
        </section>
        <aside className="app__layers">
          <LayerStack
            layers={layers}
            catalog={catalog}
            lastReason={reason}
            onRemove={store.remove}
            onReorder={store.reorder}
            onParam={store.setParam}
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
