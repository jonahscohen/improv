import { generateSelector } from '../element-utils.js';
import { PreviewEngine } from '../preview-engine.js';
import { ChangeBuffer } from '../change-buffer.js';
import { captureEnvironment } from '../environment.js';
import { Overlay } from '../overlay.js';
import { Transport } from '../transport.js';
import { Picker } from '../selector/picker.js';
import { getScopedStyles, getPseudoStateStyles, type ForcedState } from '../inspector/styles.js';
import { ChangeTracker } from '../engine/change-tracker.js';
import { buildScopeLevels, defaultScopeIndex } from './ui/sections/scope-levels.js';
import type { ScopeLevel } from './ui/sections/section-props.js';
import { render, h } from 'preact';
import { PropertyPanel } from './PropertyPanel.js';
import panelShellCss from './styles/panel-shell.css';
import sectionsCss from './styles/sections.css';
import controlsCss from './styles/controls.css';
import colorGradientCss from './styles/color-gradient.css';
import typographyCss from './styles/typography.css';
import elementsTreeCss from './styles/elements-tree.css';

/** camelCase CSS property (what sections emit) -> kebab-case (what the CSS
 *  engine + change buffer store). e.g. "backgroundColor" -> "background-color". */
function camelToKebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

// NOTE: the vanilla ./property-panel.ts is intentionally NOT imported anymore.
// It stays on disk (to be removed in a later phase) but is no longer
// instantiated - the Preact <PropertyPanel> above replaces it.

export class ManipulateMode {
  private overlay: Overlay;
  private preview: PreviewEngine;
  private changeBuffer: ChangeBuffer;
  private transport: Transport;

  private active = false;
  private selectedElement: HTMLElement | null = null;
  private selectedSelector: string | null = null;

  // Scoped/computed styles for the selected element (camelCase keys, e.g.
  // scopedStyles.width / .opacity) + the props the active scope rule authors.
  // Stashed on selectElement and fed to the panel; also the oldValue source for
  // changeBuffer.add. Scope = the element's own selector for now (Ph7 = rail).
  private scopedStyles: Record<string, string> = {};
  private ownedProperties: Set<string> = new Set();

  // Scope rail (Target): the levels for the selected element + the active level.
  // The active level's selector is the EDIT selector - a class scope edits the
  // RULE (siblings update); the instance level edits the element's own selector.
  private scopeLevels: ScopeLevel[] = [];
  private activeLevelIndex = 0;

  // Forced pseudo-state preview (:hover/:focus/:active). When set, the matching
  // rule's styles are applied INLINE on the element; forcedStateProps tracks the
  // kebab props we set so we can clear them on change / reselect.
  private forcedState: ForcedState = null;
  private forcedStateProps: string[] = [];

  // Engine ChangeTracker - the ATTRIBUTE-change record path (alt/loading/loop/
  // ...), kept DISTINCT from the CSS changeBuffer. Sections apply the attribute
  // to the live node themselves; onAttributeChange only records it here.
  private tracker = new ChangeTracker();

  // Part B: the Core instance (set by core/index.ts after construction, mirroring
  // PromptMode._core). Manipulate edits upsert per-element tasks into the shared
  // core._changeQueue + bottom-left pill; send reuses prompt mode's path.
  private _core: any = null;

  // Attribute edits mirrored here (selector -> { attr: newValue }) so syncQueue
  // can render them in the per-element task body alongside CSS changes.
  private attrChanges = new Map<string, Record<string, string>>();
  // Original attribute values (captured on first edit) so a discarded task can restore them.
  private attrOriginals = new Map<string, Record<string, string>>();
  // Snapshot of the element's original COMPUTED values (at selection, normalized) so an
  // edit that returns a property to its original (e.g. the section "-" button) reverts.
  private originalComputed: Record<string, string> = {};

  // Phase 8b: the ported Retune on-page selection picker. It owns the rich
  // hover/selection chrome (box + tag/size badge + handles + parent indicator)
  // and the click-to-cycle z-stack, replacing the old inline mousemove/click
  // hover-and-highlight logic. Mounted into the overlay's shadow root.
  private picker: Picker | null = null;

  // Preact panel mount: a container inside the shadow root that the
  // <PropertyPanel> tree renders into, plus the constructable stylesheet that
  // carries the theme tokens + shell CSS, and the system-theme listener.
  private panelContainer: HTMLDivElement | null = null;
  private panelSheets: CSSStyleSheet[] = [];
  private themeMediaQuery: MediaQueryList | null = null;
  private themeListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor(
    overlay: Overlay,
    preview: PreviewEngine,
    changeBuffer: ChangeBuffer,
    transport: Transport,
  ) {
    this.overlay = overlay;
    this.preview = preview;
    this.changeBuffer = changeBuffer;
    this.transport = transport;
  }

  activate(): void {
    if (this.active) return;
    this.active = true;

    this.preview.attach();
    this.installPanelChrome();

    // Build + activate the picker against the overlay's shadow root (shared with
    // the Preact panel). The picker draws its own chrome and excludes panel UI
    // from selection (composedPath / shadow elementFromPoint checks).
    //
    // We deliberately do NOT enable the old event-intercept "freeze" sheet here:
    // it sets `html { pointer-events: none }`, which would make the picker's
    // direct elementFromPoint() hit-testing return nothing. The picker is
    // self-sufficient - it swallows page clicks in the capture phase and forces
    // a default cursor globally (Retune's interaction model).
    this.picker = new Picker();
    this.picker
      // Hover chrome (box + tag/size badge) is rendered by the picker itself; no
      // work needed here.
      .onHover(() => {})
      .onSelect(({ element, selector }) =>
        this.selectElement(element as HTMLElement, selector),
      )
      .init({
        root: this.overlay.getShadowRoot(),
        onCancel: () => this.clearSelection(),
        // TODO (on-element-edit pass): wire onResize/onReposition/onCanvasReorder
        // to preview.applyChange + changeBuffer.add. Left unset for now - the
        // picker no-ops these safely (optional chaining), drag just doesn't persist.
      });
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;

    this.clearForcedState();
    if (this.picker) {
      this.picker.destroy();
      this.picker = null;
    }
    // Defensive: ensure no stale legacy highlight lingers (none is created now).
    this.overlay.hideHighlight();

    this.teardownPanelChrome();

    this.selectedElement = null;
    this.selectedSelector = null;
    this.scopedStyles = {};
    this.ownedProperties = new Set();
    this.scopeLevels = [];
    this.activeLevelIndex = 0;
  }

  /**
   * Select an element and show its Design panel. Called by the picker's onSelect
   * (with a finder-derived selector) and available for programmatic selection.
   * Seeds the selection state the change/preview/transport pipeline reads.
   */
  selectElement(el: HTMLElement, selector?: string): void {
    // Clear any forced pseudo-state preview from the previously selected element.
    this.clearForcedState();

    this.selectedElement = el;
    // Prefer the picker's stable finder selector; fall back to generateSelector.
    this.selectedSelector = selector || generateSelector(el);

    // Note: the picker owns the selection chrome (box/handles/badge) now, so we
    // no longer call overlay.trackElement() - that would draw a second box.

    // Build the scope/Target rail (class -> ancestor -> "This instance") and pick
    // the default level (narrowest class level, levels.length - 2). The active
    // level's selector is the EDIT selector: a class scope edits the RULE.
    this.scopeLevels = buildScopeLevels(el);
    this.activeLevelIndex = defaultScopeIndex(this.scopeLevels);

    // Pull the scoped/computed styles the Design sections bind to, for the active
    // scope. getScopedStyles resolves var() + respects cascade; for a class scope
    // it returns the rule's authored values (+ ownedProperties).
    this.refreshScopedStyles();
    // Snapshot original computed values now (no edits yet) for back-to-original detection.
    this.originalComputed = this.snapshotComputed();

    // Paint matches for the active class scope (skip ancestor/instance).
    this.updateScopeHighlights();

    // Register the element with the engine ChangeTracker so attribute changes
    // (ImageSection: alt/loading/loop/...) have a tracked entry to record onto.
    // Distinct from the CSS changeBuffer.
    this.tracker.track(
      this.selectedSelector,
      el.tagName.toLowerCase(),
      el.textContent,
      Array.from(el.classList),
      [],
      this.scopedStyles,
    );

    // The Preact panel becomes visible for this element (Design tab is default),
    // animating in (translateY 12px, 150ms), populated from scopedStyles.
    this.renderPanel();
  }

  /** The selector edits/preview/change-records target: the active scope level's
   *  class selector when it is a non-null single-scope class selector (edit the
   *  RULE), otherwise the element's own instance selector (ancestor/instance). */
  private activeEditSelector(): string | null {
    const sel = this.scopeLevels[this.activeLevelIndex]?.selector;
    // Class scope (no descendant combinator) -> edit the rule. Else -> instance.
    if (sel && !sel.includes(' ')) return sel;
    return this.selectedSelector;
  }

  /** Recompute scopedStyles + ownedProperties for the current element + scope. */
  private refreshScopedStyles(): void {
    if (!this.selectedElement) return;
    const sel = this.activeEditSelector() ?? this.selectedSelector ?? '';
    const scoped = getScopedStyles(this.selectedElement, sel);
    this.scopedStyles = scoped.styles;
    this.ownedProperties = scoped.ownedProperties;
  }

  /** Show on-page highlights for the active class scope; hide for instance/ancestor. */
  private updateScopeHighlights(): void {
    const level = this.scopeLevels[this.activeLevelIndex];
    if (level?.selector && !level.selector.includes(' ') && this.selectedElement) {
      this.picker?.showScopeHighlights(level.selector, this.selectedElement);
    } else {
      this.picker?.hideScopeHighlights();
    }
  }

  /** Clear the current selection: tear down picker chrome and hide the panel. */
  private clearSelection(): void {
    this.clearForcedState();
    this.picker?.hideScopeHighlights();
    this.selectedElement = null;
    this.selectedSelector = null;
    this.scopedStyles = {};
    this.ownedProperties = new Set();
    this.scopeLevels = [];
    this.activeLevelIndex = 0;
    this.picker?.clearSelection();
    this.renderPanel();
  }

  /** Switch the active scope level: recompute styles for the new scope, repaint
   *  highlights, re-render. Edits now target the new scope's selector. */
  private handleScopeLevelChange = (index: number): void => {
    if (index < 0 || index >= this.scopeLevels.length) return;
    this.activeLevelIndex = index;
    this.refreshScopedStyles();
    this.updateScopeHighlights();
    this.renderPanel();
  };

  /** Transient highlight on scope-level hover (index or null on leave). */
  private handleScopeLevelHover = (index: number | null): void => {
    if (index === null) {
      // Restore the active level's highlights.
      this.updateScopeHighlights();
      return;
    }
    const level = this.scopeLevels[index];
    if (level?.selector && !level.selector.includes(' ') && this.selectedElement) {
      this.picker?.showScopeHighlights(level.selector, this.selectedElement);
    } else {
      this.picker?.hideScopeHighlights();
    }
  };

  /** Forced pseudo-state preview: apply the matching rule's styles inline on the
   *  element (clearing any previous), or clear when null. */
  private handleForcedStateChange = (state: ForcedState | null): void => {
    this.clearForcedState();
    if (state && this.selectedElement) {
      const styles = getPseudoStateStyles(this.selectedElement, state);
      const el = this.selectedElement;
      this.forcedStateProps = Object.keys(styles);
      for (const [prop, val] of Object.entries(styles)) el.style.setProperty(prop, val);
      this.forcedState = state;
    }
    this.renderPanel();
  };

  /** Remove any inline forced-pseudo-state styles we applied. */
  private clearForcedState(): void {
    if (this.selectedElement && this.forcedStateProps.length > 0) {
      for (const prop of this.forcedStateProps) this.selectedElement.style.removeProperty(prop);
      if (this.selectedElement.getAttribute('style')?.trim() === '') {
        this.selectedElement.removeAttribute('style');
      }
    }
    this.forcedStateProps = [];
    this.forcedState = null;
  }

  /** Snapshot the selected element's original COMPUTED values (normalized) for the
   *  panel's keys, so handlePropertyChange can detect an edit that returns a property
   *  to its original and treat it as a revert (drops it from the task). */
  private snapshotComputed(): Record<string, string> {
    const out: Record<string, string> = {};
    if (!this.selectedElement) return out;
    const cs = getComputedStyle(this.selectedElement);
    for (const key of Object.keys(this.scopedStyles)) {
      out[key] = cs.getPropertyValue(camelToKebab(key)).trim();
    }
    return out;
  }

  /** Merge a single property value into scopedStyles for panel reactivity, expanding
   *  border shorthands to the longhands section gating reads (border-width ->
   *  border-{Top,Right,Bottom,Left}-width). Used by the edit + per-control-reset paths. */
  private mergeScopedStyle(prop: string, value: string): void {
    const next: Record<string, string> = { ...this.scopedStyles, [prop]: value };
    const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
    if (prop === 'borderWidth') SIDES.forEach((sd) => (next[`border${sd}Width`] = value));
    else if (prop === 'borderStyle') SIDES.forEach((sd) => (next[`border${sd}Style`] = value));
    else if (prop === 'borderColor') SIDES.forEach((sd) => (next[`border${sd}Color`] = value));
    this.scopedStyles = next;
  }

  /**
   * A Design control edited a CSS property. This is the live-preview + change-
   * record spine every section funnels through. Sections emit CAMELCASE props
   * (e.g. "backgroundColor"); we convert to kebab for the CSS engine + buffer.
   *   - preview.applyChange -> instant on-page preview (constructable !important sheet)
   *   - changeBuffer.add     -> records the diff (oldValue from scopedStyles)
   * The lead wires the Claudebar/send ON TOP of these changeBuffer entries.
   */
  private handlePropertyChange = (prop: string, value: string): void => {
    const sel = this.activeEditSelector();
    if (!sel) return;
    const kebab = camelToKebab(prop);
    this.preview.applyChange(sel, kebab, value);

    // If this returns the property to its ORIGINAL computed value (e.g. the section
    // "-"/minus setting a pending fill back to transparent), it's not a change: revert
    // it so the task drops it (removed when empty) and the live view resets to original.
    const orig = this.originalComputed[prop];
    const effective = this.selectedElement
      ? getComputedStyle(this.selectedElement).getPropertyValue(kebab).trim() : '';
    if (orig !== undefined && effective === orig) {
      this.preview.removeChange(sel, kebab);
      for (const c of this.changeBuffer.getAll()) {
        if (c.selector === sel && c.property === kebab) this.changeBuffer.remove(c.id);
      }
      this.mergeScopedStyle(prop, value);
      this.renderPanel();
      this.syncQueue();
      (this._core as any)?._refreshOpenQueuePanel?.();
      return;
    }

    const oldValue = this.scopedStyles[prop] ?? '';
    this.changeBuffer.add(sel, kebab, oldValue, value);
    // Merge the change into scopedStyles + re-render so the panel is reactive (the
    // 1:1 sections assume Retune's reactive store; this is our spine feeding it).
    // NOT getScopedStyles - it walks CSSOM rules and can't see the preview's adopted sheet.
    this.mergeScopedStyle(prop, value);
    this.renderPanel();
    this.syncQueue();
  };

  /**
   * Part B: reflect the current buffered edits as ONE queued task per selector in
   * the shared core._changeQueue (tagged _manipulate so we only manage ours), then
   * refresh the bottom-left pill. The pill's existing click -> queue panel -> Send
   * All path then pushes one `push_prompt` per task (reusing prompt mode entirely).
   * Task body: "Apply these CSS changes to `<selector>`:\n- <prop>: <value>" plus a
   * "### Attribute Changes" block when the element has attribute edits.
   */
  private syncQueue(): void {
    const core = this._core;
    if (!core || !Array.isArray(core._changeQueue)) return;
    const queue: any[] = core._changeQueue;

    // Drop our previously-synced items; rebuild from the current buffers.
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i] && queue[i]._manipulate) queue.splice(i, 1);
    }

    // Group CSS changes by their (edit) selector.
    const cssBySel = new Map<string, string[]>();
    for (const c of this.changeBuffer.getAll()) {
      if (!cssBySel.has(c.selector)) cssBySel.set(c.selector, []);
      cssBySel.get(c.selector)!.push(`- ${c.property}: ${c.newValue}`);
    }

    const selectors = new Set<string>([...cssBySel.keys(), ...this.attrChanges.keys()]);
    const tag = this.selectedElement?.tagName.toLowerCase() ?? 'div';
    const node: Element = this.selectedElement ?? document.body;

    for (const sel of selectors) {
      const css = cssBySel.get(sel) ?? [];
      const attrs = this.attrChanges.get(sel) ?? {};
      const attrLines = Object.entries(attrs).map(([a, v]) => `- ${a}: ${v}`);
      let prompt = '';
      if (css.length) prompt += `Apply these CSS changes to \`${sel}\`:\n${css.join('\n')}`;
      if (attrLines.length) {
        prompt += (prompt ? '\n\n' : '') +
          `### Attribute Changes\nApply these attribute changes to \`${sel}\`:\n${attrLines.join('\n')}`;
      }
      if (!prompt) continue;
      queue.push({
        _manipulate: true,
        prompt,
        elements: [{ domNode: node, selector: sel, tagName: tag }],
      });
    }

    core._showQueuePill();
  }

  /**
   * Discard a queued Manipulate task: revert its live CSS preview + buffered
   * changes (and any attribute edits) so the element returns to its original
   * appearance. Called when its task is removed from the queue without sending.
   * Does NOT touch the queue entry - the caller already removed it.
   */
  revertSelector(sel: string): void {
    for (const c of this.changeBuffer.getAll().filter((ch) => ch.selector === sel)) {
      this.preview.removeChange(c.selector, c.property);
      this.changeBuffer.remove(c.id);
    }
    const attrs = this.attrChanges.get(sel);
    if (attrs) {
      const node = document.querySelector(sel);
      const orig = this.attrOriginals.get(sel) ?? {};
      if (node) {
        for (const attr of Object.keys(attrs)) {
          const ov = orig[attr];
          if (ov === undefined || ov === '') node.removeAttribute(attr);
          else node.setAttribute(attr, ov);
        }
      }
      this.attrChanges.delete(sel);
      this.attrOriginals.delete(sel);
    }
    // Reset the panel controls (re-read original computed styles + re-render) if we
    // just reverted the element it is showing - so the changed options reset, not
    // just the live element.
    if (sel === this.activeEditSelector()) { this.refreshScopedStyles(); this.renderPanel(); }
  }

  /** Revert ALL Manipulate previews + attribute edits (Clear All discard path). */
  revertAll(): void {
    this.preview.clearAll();
    this.changeBuffer.clear();
    for (const [sel, attrs] of this.attrChanges) {
      const node = document.querySelector(sel);
      const orig = this.attrOriginals.get(sel) ?? {};
      if (node) {
        for (const attr of Object.keys(attrs)) {
          const ov = orig[attr];
          if (ov === undefined || ov === '') node.removeAttribute(attr);
          else node.setAttribute(attr, ov);
        }
      }
    }
    this.attrChanges.clear();
    this.attrOriginals.clear();
    this.refreshScopedStyles();
    this.renderPanel();
  }

  /** A control was hovered (for the box-model overlay). No-op until that wiring. */
  private handlePropertyHover = (_prop: string | null): void => {
    // TODO (box-model overlay phase): highlight padding/margin/gap on the element.
  };

  /** Per-property change state for ChangeIndicator + controls. `prop` is camelCase. */
  private changeProps = (prop: string): { isChanged: boolean; onReset: () => void } => {
    const kebab = camelToKebab(prop);
    const sel = this.activeEditSelector();
    const isChanged = !!sel && this.changeBuffer.getAll().some(
      (c) => c.selector === sel && c.property === kebab,
    );
    return {
      isChanged,
      onReset: () => {
        if (!sel) return;
        this.preview.removeChange(sel, kebab);
        for (const c of this.changeBuffer.getAll()) {
          if (c.selector === sel && c.property === kebab) {
            // Restore the control to its original value (don't nuke other pending edits).
            this.mergeScopedStyle(prop, c.oldValue);
            this.changeBuffer.remove(c.id);
          }
        }
        // Update the queue (drop this change from the task; remove the task if now
        // empty), refresh the queuebar panel if it's open, then reflect in the panel.
        this.syncQueue();
        (this._core as any)?._refreshOpenQueuePanel?.();
        this.renderPanel();
      },
    };
  };

  /** Shorthand-group change state (a set of props edited together, e.g. padding
   *  H/V, border widths). Changed if ANY member changed; reset reverts all. */
  private shorthandChangeProps = (props: string[]): { isChanged: boolean; onReset: () => void } => ({
    isChanged: props.some((p) => this.changeProps(p).isChanged),
    onReset: () => props.forEach((p) => this.changeProps(p).onReset()),
  });

  /** HTML/SVG attribute change - DISTINCT from the CSS path. The section already
   *  applied the attribute to the live node; we only RECORD it on the engine
   *  ChangeTracker (-> "### Attribute Changes" in the output), never the buffer. */
  private handleAttributeChange = (attr: string, oldValue: string, newValue: string): void => {
    if (!this.selectedSelector) return;
    this.tracker.recordAttributeChange(this.selectedSelector, attr, oldValue, newValue);
    // Mirror for the queue body (keyed by the element's instance selector).
    const m = this.attrChanges.get(this.selectedSelector) ?? {};
    m[attr] = newValue;
    this.attrChanges.set(this.selectedSelector, m);
    // Capture the true original once, so a discarded task can restore it.
    const o = this.attrOriginals.get(this.selectedSelector) ?? {};
    if (!(attr in o)) { o[attr] = oldValue; this.attrOriginals.set(this.selectedSelector, o); }
    this.syncQueue();
  };

  /**
   * Install the shadow-root chrome the Preact panel needs: the theme/shell
   * stylesheet on adoptedStyleSheets, the system dark-mode listener (toggles
   * `.dark` on the shadow host), and the mount container. Idempotent.
   */
  private installPanelChrome(): void {
    const shadow = this.overlay.getShadowRoot();

    // 1. Theme/shell + section CSS as constructable stylesheets (mirrors
    //    PreviewEngine). panel-shell first (defines tokens), then sections.
    if (this.panelSheets.length === 0) {
      // panel-shell FIRST (defines tokens), then the rest. color-gradient also
      // carries the FloatingDialog shell the FontInput / color pickers need.
      for (const css of [panelShellCss, sectionsCss, controlsCss, colorGradientCss, typographyCss, elementsTreeCss]) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        this.panelSheets.push(sheet);
      }
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, ...this.panelSheets];
    }

    // 2. System theme -> toggle `.dark` on the shadow host (Retune's "system"
    //    default; SettingsPanel with explicit light/dark comes later).
    const host = shadow.host as HTMLElement;
    if (!this.themeMediaQuery) {
      this.themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      host.classList.toggle('dark', this.themeMediaQuery.matches);
      this.themeListener = (e: MediaQueryListEvent) => host.classList.toggle('dark', e.matches);
      this.themeMediaQuery.addEventListener('change', this.themeListener);
    }

    // 3. Mount container inside the overlay container (which is pointer-events:
    //    none; the panel itself re-enables pointer-events via .retune-panel).
    if (!this.panelContainer) {
      this.panelContainer = document.createElement('div');
      this.panelContainer.dataset['justify'] = '';
      this.overlay.getContainer().appendChild(this.panelContainer);
      this.renderPanel();
    }
  }

  /** (Re)render the Preact panel. visible follows whether an element is selected. */
  private renderPanel(): void {
    if (!this.panelContainer) return;
    const label = this.selectedElement
      ? this.selectedElement.tagName.toLowerCase()
      : undefined;
    render(
      h(PropertyPanel, {
        visible: !!this.selectedElement,
        side: 'right',
        version: '',
        selectedLabel: label,
        element: this.selectedElement,
        selector: this.selectedSelector,
        s: this.scopedStyles,
        ownedProperties: this.ownedProperties,
        onPropertyChange: this.handlePropertyChange,
        onPropertyHover: this.handlePropertyHover,
        changeProps: this.changeProps,
        shorthandChangeProps: this.shorthandChangeProps,
        onAttributeChange: this.handleAttributeChange,
        scopeLevels: this.scopeLevels,
        activeLevelIndex: this.activeLevelIndex,
        onScopeLevelChange: this.handleScopeLevelChange,
        onScopeLevelHover: this.handleScopeLevelHover,
        forcedState: this.forcedState,
        onForcedStateChange: this.handleForcedStateChange,
        // Elements tab (ElementTree) two-way selection + hover sync.
        // setSelected() both paints the on-page selection chrome (showSelection)
        // AND fires the picker's onSelect callback -> this.selectElement (wired in
        // activate()), so the scope rail + Design tab + panel all update through the
        // EXACT same path a page-click uses. One call drives both halves of the sync.
        onElementSelect: (el: Element) => this.picker?.setSelected(el),
        // el -> show the picker hover highlight on that element; null -> clear it.
        onElementHover: (el: Element | null) => this.picker?.highlight(el),
      }),
      this.panelContainer,
    );
  }

  /** Tear down the panel chrome on deactivate. */
  private teardownPanelChrome(): void {
    if (this.panelContainer) {
      render(null, this.panelContainer);
      this.panelContainer.remove();
      this.panelContainer = null;
    }
    const shadow = this.overlay.getShadowRoot();
    if (this.panelSheets.length > 0) {
      shadow.adoptedStyleSheets = shadow.adoptedStyleSheets.filter((s) => !this.panelSheets.includes(s));
      this.panelSheets = [];
    }
    if (this.themeMediaQuery && this.themeListener) {
      this.themeMediaQuery.removeEventListener('change', this.themeListener);
    }
    (shadow.host as HTMLElement).classList.remove('dark');
    this.themeMediaQuery = null;
    this.themeListener = null;
  }

  async applyChanges(): Promise<void> {
    const changes = this.changeBuffer.flush();
    if (changes.length === 0) return;

    await this.transport.request('push_changes', { changes, environment: captureEnvironment() });
    this.preview.clearAll();
  }

  isActive(): boolean {
    return this.active;
  }
}
