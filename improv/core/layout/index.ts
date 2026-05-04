import type { Overlay } from '../overlay';
import type { Transport } from '../transport';
import type { LayoutPlacementData } from '../types';
import { ComponentPalette } from './palette';
import { SkeletonRenderer } from './skeleton';
import { GuideLineRenderer } from './guide-lines';
import { SectionDetector } from './rearrange';
import { computeSnap } from './snap';
import type { SnapTarget } from './snap';
import { getPrimitive, PRIMITIVES } from './primitives';

const CATEGORY_COLORS: Record<string, string> = {
  layout:   '#3b82f6',
  content:  '#8b5cf6',
  controls: '#22c55e',
  elements: '#f97316',
  blocks:   '#ec4899',
};

export class LayoutMode {
  private overlay: Overlay;
  private transport: Transport;

  private palette: ComponentPalette | null = null;
  private skeletonRenderer: SkeletonRenderer | null = null;
  private guideLineRenderer: GuideLineRenderer | null = null;
  private sectionDetector: SectionDetector | null = null;

  private placements: LayoutPlacementData[] = [];
  private applyBtn: HTMLButtonElement | null = null;
  private previewPanel: HTMLDivElement | null = null;
  private selectedSkeletonId: string | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(overlay: Overlay, transport: Transport) {
    this.overlay   = overlay;
    this.transport = transport;
  }

  activate(): void {
    const shadow    = this.overlay.getShadowRoot();
    const container = this.overlay.getContainer();

    this.skeletonRenderer  = new SkeletonRenderer(container);
    this.guideLineRenderer = new GuideLineRenderer(container);
    this.sectionDetector   = new SectionDetector();

    // Build component list from all PRIMITIVES
    const components = PRIMITIVES.map((p) => ({ name: p.name, category: p.category }));
    this.palette = new ComponentPalette(shadow, components);

    this.palette.onDrop((type, category, clientX, clientY) => {
      this.handleDrop(type, category, clientX, clientY);
    });

    // Wire clear callback to remove all skeletons
    this.palette.onClear(() => {
      this.skeletonRenderer?.clear();
      this.placements = [];
      this.selectedSkeletonId = null;
    });

    // Delete/Backspace removes selected skeleton
    this.keydownHandler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedSkeletonId) {
        this.skeletonRenderer?.remove(this.selectedSkeletonId);
        this.placements = this.placements.filter((p) => p.id !== this.selectedSkeletonId);
        this.selectedSkeletonId = null;
      }
    };
    document.addEventListener('keydown', this.keydownHandler);

    this.sectionDetector.enable((sections) => {
      console.debug('[improv] sections reordered', sections.length);
    });

    this.applyBtn = this.buildApplyButton(shadow);
  }

  deactivate(): void {
    this.palette?.destroy();
    this.skeletonRenderer?.clear();
    this.guideLineRenderer?.hide();
    this.sectionDetector?.disable();
    this.applyBtn?.remove();
    this.previewPanel?.remove();

    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    this.palette            = null;
    this.skeletonRenderer   = null;
    this.guideLineRenderer  = null;
    this.sectionDetector    = null;
    this.applyBtn           = null;
    this.previewPanel       = null;
    this.placements         = [];
    this.selectedSkeletonId = null;
  }

  private handleDrop(type: string, category: string, clientX: number, clientY: number): void {
    const prim = getPrimitive(type);
    const w    = prim?.defaultWidth  ?? 200;
    const h    = prim?.defaultHeight ?? 80;

    // Center skeleton on cursor
    const x = clientX - w / 2;
    const y = clientY - h / 2;

    const snapResult = computeSnap(
      { x, y, width: w, height: h },
      this.buildSnapTargets(),
    );

    const placement: LayoutPlacementData = {
      id:            `layout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      componentType: type,
      category,
      x:             snapResult.snappedX,
      y:             snapResult.snappedY,
      width:         w,
      height:        h,
      scrollY:       window.scrollY,
    };

    this.placements.push(placement);

    const color = CATEGORY_COLORS[category] ?? '#3b82f6';
    const el    = this.skeletonRenderer!.create(placement, color);

    this.guideLineRenderer!.show(
      snapResult.guides.map((g) => ({
        axis:     g.axis,
        position: g.position,
      })),
    );

    this.wireDrag(el, placement);

    setTimeout(() => this.guideLineRenderer?.hide(), 800);
  }

  private wireDrag(el: HTMLDivElement, placement: LayoutPlacementData): void {
    let startX   = 0;
    let startY   = 0;
    let originX  = placement.x;
    let originY  = placement.y;
    let dragging = false;

    el.addEventListener('mousedown', (e: MouseEvent) => {
      // Don't start drag when clicking on a resize handle
      if ((e.target as HTMLElement).style.cursor?.includes('resize')) return;

      // Select this skeleton
      if (this.selectedSkeletonId && this.selectedSkeletonId !== placement.id) {
        this.skeletonRenderer?.deselect(this.selectedSkeletonId);
      }
      this.selectedSkeletonId = placement.id;
      this.skeletonRenderer?.select(placement.id);

      dragging = true;
      startX   = e.clientX;
      startY   = e.clientY;
      originX  = placement.x;
      originY  = placement.y;
      e.preventDefault();
    });

    const onMove = (e: MouseEvent): void => {
      if (!dragging) return;

      const dx         = e.clientX - startX;
      const dy         = e.clientY - startY;
      const proposedX  = originX + dx;
      const proposedY  = originY + dy;

      const snapResult = computeSnap(
        { x: proposedX, y: proposedY, width: placement.width, height: placement.height },
        this.buildSnapTargets(placement.id),
      );

      placement.x = snapResult.snappedX;
      placement.y = snapResult.snappedY;

      this.skeletonRenderer!.update(placement.id, placement.x, placement.y);

      // Enrich guides with distance data
      const guides = snapResult.guides.map((g) => {
        if (g.axis === 'x') {
          const dist = Math.abs(g.position - placement.x);
          return { axis: g.axis, position: g.position, distance: dist };
        } else {
          const dist = Math.abs(g.position - placement.y);
          return { axis: g.axis, position: g.position, distance: dist };
        }
      });

      this.guideLineRenderer!.show(guides);
    };

    const onUp = (): void => {
      if (!dragging) return;
      dragging = false;
      setTimeout(() => this.guideLineRenderer?.hide(), 400);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  private buildSnapTargets(excludeId?: string): SnapTarget[] {
    return this.placements
      .filter((p) => p.id !== excludeId)
      .map((p) => ({ x: p.x, y: p.y, width: p.width, height: p.height }));
  }

  private buildApplyButton(shadow: ShadowRoot): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = 'Apply Layout';

    Object.assign(btn.style, {
      position:      'fixed',
      bottom:        '40px',
      left:          '240px',
      padding:       '10px 20px',
      background:    '#3b82f6',
      color:         '#fff',
      border:        'none',
      borderRadius:  '8px',
      fontFamily:    'system-ui, sans-serif',
      fontSize:      '13px',
      fontWeight:    '600',
      cursor:        'pointer',
      zIndex:        '2147483646',
      pointerEvents: 'all',
      boxShadow:     '0 2px 16px rgba(59,130,246,0.5)',
      transition:    'background 120ms ease, transform 80ms ease, box-shadow 120ms ease',
      letterSpacing: '0.02em',
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.background  = '#2563eb';
      btn.style.boxShadow   = '0 4px 20px rgba(59,130,246,0.6)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background  = '#3b82f6';
      btn.style.boxShadow   = '0 2px 16px rgba(59,130,246,0.5)';
    });
    btn.addEventListener('mousedown', () => {
      btn.style.transform   = 'scale(0.97)';
    });
    btn.addEventListener('mouseup', () => {
      btn.style.transform   = '';
    });

    btn.addEventListener('click', () => {
      this.showPreviewPanel(shadow);
    });

    shadow.appendChild(btn);
    return btn;
  }

  private showPreviewPanel(shadow: ShadowRoot): void {
    // Remove existing panel
    this.previewPanel?.remove();

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position:      'fixed',
      bottom:        '90px',
      left:          '240px',
      width:         '360px',
      maxHeight:     '360px',
      background:    '#1a1a2e',
      border:        '1px solid #333',
      borderRadius:  '12px',
      boxShadow:     '0 8px 40px rgba(0,0,0,0.6)',
      zIndex:        '2147483646',
      pointerEvents: 'all',
      fontFamily:    'system-ui, -apple-system, sans-serif',
      display:       'flex',
      flexDirection: 'column',
      overflow:      'hidden',
    });

    // Panel header
    const panelHeader = document.createElement('div');
    Object.assign(panelHeader.style, {
      padding:       '14px 16px 12px',
      borderBottom:  '1px solid #2a2a3e',
      flexShrink:    '0',
    });

    const panelTitle = document.createElement('div');
    panelTitle.textContent = `${this.placements.length} component${this.placements.length !== 1 ? 's' : ''} to place`;
    Object.assign(panelTitle.style, {
      color:         '#e0e0ee',
      fontSize:      '13px',
      fontWeight:    '600',
    });

    const panelSub = document.createElement('div');
    panelSub.textContent = 'Review positions before pushing to Claude';
    Object.assign(panelSub.style, {
      color:         '#666',
      fontSize:      '11px',
      marginTop:     '3px',
    });

    panelHeader.appendChild(panelTitle);
    panelHeader.appendChild(panelSub);
    panel.appendChild(panelHeader);

    // Placement list
    const listArea = document.createElement('div');
    Object.assign(listArea.style, {
      flex:       '1',
      overflowY:  'auto',
      padding:    '8px 0',
    });

    for (const p of this.placements) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display:     'flex',
        alignItems:  'center',
        padding:     '6px 16px',
        gap:         '10px',
      });

      const color = CATEGORY_COLORS[p.category] ?? '#3b82f6';

      const dot = document.createElement('div');
      Object.assign(dot.style, {
        width:        '7px',
        height:       '7px',
        borderRadius: '50%',
        background:   color,
        flexShrink:   '0',
      });

      const name = document.createElement('span');
      name.textContent = p.componentType;
      Object.assign(name.style, {
        color:      '#b0b0c0',
        fontSize:   '12px',
        fontWeight: '500',
        flex:       '1',
      });

      const pos = document.createElement('span');
      pos.textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;
      Object.assign(pos.style, {
        color:      '#555',
        fontSize:   '11px',
        fontFamily: 'monospace',
      });

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(pos);
      listArea.appendChild(row);
    }

    panel.appendChild(listArea);

    // Action buttons
    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display:       'flex',
      gap:           '8px',
      padding:       '12px 16px',
      borderTop:     '1px solid #2a2a3e',
      flexShrink:    '0',
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      flex:          '1',
      padding:       '8px',
      background:    'transparent',
      border:        '1px solid #333',
      borderRadius:  '7px',
      color:         '#888',
      fontSize:      '12px',
      fontWeight:    '600',
      cursor:        'pointer',
      fontFamily:    'system-ui, sans-serif',
      transition:    'border-color 100ms ease, color 100ms ease',
    });
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.borderColor = '#555';
      cancelBtn.style.color       = '#aaa';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.borderColor = '#333';
      cancelBtn.style.color       = '#888';
    });
    cancelBtn.addEventListener('click', () => {
      panel.remove();
      this.previewPanel = null;
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Push Layout';
    Object.assign(confirmBtn.style, {
      flex:          '2',
      padding:       '8px',
      background:    '#3b82f6',
      border:        'none',
      borderRadius:  '7px',
      color:         '#fff',
      fontSize:      '12px',
      fontWeight:    '600',
      cursor:        'pointer',
      fontFamily:    'system-ui, sans-serif',
      transition:    'background 100ms ease',
    });
    confirmBtn.addEventListener('mouseenter', () => {
      confirmBtn.style.background = '#2563eb';
    });
    confirmBtn.addEventListener('mouseleave', () => {
      confirmBtn.style.background = '#3b82f6';
    });
    confirmBtn.addEventListener('click', () => {
      this.pushLayout(panel);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    panel.appendChild(actions);

    shadow.appendChild(panel);
    this.previewPanel = panel;
  }

  private pushLayout(panel: HTMLDivElement): void {
    this.transport
      .request('push_layout', { placements: this.placements })
      .then(() => {
        this.showConfirmationFlash();
      })
      .catch(() => {
        // Non-fatal if transport is not connected - still show flash
        this.showConfirmationFlash();
      });

    panel.remove();
    this.previewPanel = null;
  }

  private showConfirmationFlash(): void {
    const shadow = this.overlay.getShadowRoot();
    const flash  = document.createElement('div');
    flash.textContent = 'Layout pushed';

    Object.assign(flash.style, {
      position:      'fixed',
      bottom:        '40px',
      left:          '240px',
      padding:       '10px 20px',
      background:    '#22c55e',
      color:         '#fff',
      border:        'none',
      borderRadius:  '8px',
      fontFamily:    'system-ui, sans-serif',
      fontSize:      '13px',
      fontWeight:    '600',
      zIndex:        '2147483646',
      pointerEvents: 'none',
      boxShadow:     '0 2px 16px rgba(34,197,94,0.5)',
      transition:    'opacity 400ms ease',
      opacity:       '1',
    });

    shadow.appendChild(flash);

    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 400);
    }, 1800);
  }
}

export { ComponentPalette, isWireframe, toggleWireframe, getWireframeIcon } from './palette';
export { SkeletonRenderer } from './skeleton';
export { GuideLineRenderer } from './guide-lines';
export { SectionDetector } from './rearrange';
export { computeSnap } from './snap';
export { PRIMITIVES, getPrimitive, getPrimitivesByCategory } from './primitives';
export type { LayoutPlacementData } from '../types';
export type { PrimitiveType } from './primitives';
export type { SnapTarget, GuideLine, SnapResult } from './snap';
export type { DetectedSection } from './rearrange';
