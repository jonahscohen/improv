import { InlinePrompt } from './inline-prompt';
import { enableEventIntercept, disableEventIntercept, getElementAtPoint } from '../event-intercept';
import { generateSelector, getComputedStylesSubset, getNearbyText, getAccessibilityInfo } from '../element-utils';
import { LassoSelect as Lasso } from '../annotate/lasso';
import { MultiSelect, SelectedElement } from './multi-select';
import { createLayerIconSvg } from '../selector/layer-icon';

export { InlinePrompt } from './inline-prompt';
export { MultiSelect } from './multi-select';
export type { SelectedElement } from './multi-select';

interface ElementInfo {
  tagName: string;
  textContent: string;
  selector: string;
  classes: string[];
  computedStyles: Record<string, string>;
  boundingBox: { x: number; y: number; width: number; height: number };
  pageUrl: string;
  viewport: { width: number; height: number };
  adapterData: any[];
  nearbyText: string;
  accessibility: { role: string; label: string };
  tokens?: Record<string, string>;
}

interface QueueItem {
  prompt: string;
  elements: { domNode: Element; selector: string; tagName: string }[];
}

interface TrackedSelection {
  el: Element;
  box: HTMLDivElement;
  label: HTMLDivElement;
}

export function formatElementInfo(i: ElementInfo): string {
  let e: string[] = [],
    t = i.textContent.length > 80 ? i.textContent.slice(0, 80) + "..." : i.textContent;
  e.push(`Element: <${i.tagName}> "${t}"`);
  e.push(`Selector: ${i.selector}`);
  i.classes.length > 0 && e.push(`Classes: ${i.classes.join(" ")}`);
  let n = Object.entries(i.computedStyles);
  if (n.length > 0) {
    let o = n.map(([r, s]) => `${r}: ${s}`).join("; ");
    e.push(`Computed: ${o}`);
  }
  for (let o of i.adapterData) {
    let r = o.componentTree.join(" > ");
    if (e.push(`Component: ${r}`), o.sourceFile) {
      let s = o.sourceLine ? `${o.sourceFile}:${o.sourceLine}` : o.sourceFile;
      e.push(`Source: ${s}`);
    }
    o.props && Object.keys(o.props).length > 0 && e.push(`Props: ${JSON.stringify(o.props)}`);
  }
  if (i.tokens && Object.keys(i.tokens).length > 0) {
    let o = Object.entries(i.tokens).map(([r, s]) => `${r} maps to ${s}`).join("; ");
    e.push(`Tokens: ${o}`);
  }
  i.nearbyText && e.push(`Nearby elements: ${i.nearbyText}`);
  e.push(`Page URL: ${i.pageUrl}`);
  e.push(`Viewport: ${i.viewport.width}x${i.viewport.height}`);
  return e.join("\n");
}

export function buildElementInfo(
  el: Element,
  selector: string,
  adapterData: any[],
  computedStyles: Record<string, string>,
  nearbyText: string,
  accessibility: { role: string; label: string }
): ElementInfo {
  let s = el.getBoundingClientRect();
  return {
    tagName: (el as HTMLElement).tagName.toLowerCase(),
    textContent: (el.textContent ?? "").trim(),
    selector: selector,
    classes: Array.from((el as HTMLElement).classList),
    computedStyles: computedStyles,
    boundingBox: {
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height
    },
    pageUrl: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    adapterData: adapterData,
    nearbyText: nearbyText,
    accessibility: accessibility
  };
}

export function copyToClipboard(plainText: string, structuredData: any) {
  let t = JSON.stringify(structuredData, null, 2),
    n = `<pre>${plainText}</pre>`;
  if (typeof ClipboardItem < "u" && navigator.clipboard?.write) {
    let o = new Blob([plainText], { type: "text/plain" }),
      r = new Blob([n], { type: "text/html" }),
      s = new ClipboardItem({
        "text/plain": o,
        "text/html": r
      });
    navigator.clipboard.write([s]).catch(() => {
      fallbackCopy(t);
    });
    return;
  }
  fallbackCopy(plainText);
}

export function fallbackCopy(text: string) {
  let e = document.createElement("textarea");
  e.value = text;
  e.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
  document.body.appendChild(e);
  e.select();
  try {
    document.execCommand("copy");
  } finally {
    e.remove();
  }
}

export function isJustifyElement(node: Node | null): boolean {
  if (!node) return false;
  let e: Node | null = node;
  for (; e;) {
    if (e instanceof HTMLElement && e.hasAttribute("data-justify")) return true;
    e = (e as any).parentNode ?? (e as any).host ?? null;
  }
  return false;
}

function getElementIcon(tag: string, role: string, disp: string): string {
  if (tag === "img" || tag === "picture" || tag === "video" || tag === "svg") return "M21 3H3v18h18V3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21";
  else if (tag === "a") return "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71";
  else if (tag === "button" || role === "button") return "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z";
  else if (tag === "input" || tag === "textarea" || tag === "select") return "M4 7h16M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M8 12h4";
  else if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") return "M4 12h8M4 18V6M12 18V6M20 18v-6a2 2 0 1 0-4 0v6";
  else if (tag === "p" || tag === "span" || tag === "label" || tag === "em" || tag === "strong" || tag === "blockquote") return "M4 7h16M4 12h16M4 17h10";
  else if (tag === "ul" || tag === "ol") return "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01";
  else if (tag === "li") return "M9 12h12M9 6h12M9 18h12M5 12h.01M5 6h.01M5 18h.01";
  else if (tag === "nav") return "M3 12h18M3 6h18M3 18h18";
  else if (tag === "header") return "M3 3h18v6H3zM3 12h18v9H3z";
  else if (tag === "footer") return "M3 3h18v9H3zM3 15h18v6H3z";
  else if (tag === "section" || tag === "article" || tag === "main" || tag === "aside") return "M3 3h18v18H3zM3 9h18M9 21V9";
  else if (tag === "form") return "M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5zM15 3v5h5M10 12l2 2 4-4";
  else if (tag === "table" || tag === "tr" || tag === "td" || tag === "th") return "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18";
  else if (disp.includes("flex")) return "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z";
  else if (disp.includes("grid")) return "M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18";
  else return "M21 3H3v18h18V3z";
}

export class PromptMode {
  overlay: any;
  transport: any;
  adapters: any;
  active: boolean = false;
  prompt: InlinePrompt | null = null;
  multiSelect: MultiSelect = new MultiSelect();
  onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  _hLabel: HTMLDivElement | null = null;
  _lasso: any = null;
  _selColor: string = "#D97757";
  _selOverlays: HTMLElement[] = [];
  _getColor: (() => string) | null = null;
  mousedownX: number = 0;
  mousedownY: number = 0;
  isDragging: boolean = false;
  _claudeBtn: HTMLDivElement | null = null;
  _claudeDivider: HTMLDivElement | null = null;
  _queuePanel: HTMLDivElement | null = null;
  _queueListEl: HTMLDivElement | null = null;
  _queueHdrText: HTMLSpanElement | null = null;
  _queueBtn: HTMLDivElement | null = null;
  _queueBadge: any = null;
  _editingIdx: number = -1;
  _mouseIsDown?: boolean;
  _boundScroll?: (() => void) | null;
  _boundResize?: (() => void) | null;
  _selRaf?: number | null;
  _selTracked: TrackedSelection[] = [];
  _changeQueue: QueueItem[] = [];
  _core?: any;
  _showHints?: boolean;
  _showLabels?: boolean;
  _watchActive: boolean = false;
  _sendAllBtn?: HTMLButtonElement;
  _editOverlays: HTMLElement[] = [];
  _editTracked: Array<{el: HTMLElement; box: HTMLElement; label: HTMLElement}> = [];
  _editRaf: number | null = null;
  _actionPill?: HTMLDivElement;
  _queueCount?: HTMLSpanElement;
  _pillDivider?: HTMLDivElement;
  _queueLabel?: HTMLSpanElement;
  _queueCollapsed: boolean = false;
  _apTip?: HTMLDivElement;
  promptSentCallbacks: ((prompt: string, count: number) => void)[] = [];

  boundClick: (e: MouseEvent) => void;
  boundMousedown: (e: MouseEvent) => void;
  boundMousemove: (e: MouseEvent) => void;
  boundMouseup: (e: MouseEvent) => void;
  boundHover: (e: MouseEvent) => void;

  constructor(overlay: any, transport: any, adapters: any) {
    this.overlay = overlay;
    this.transport = transport;
    this.adapters = adapters;
    this.boundClick = this._onClick.bind(this);
    this.boundMousedown = this._onMousedown.bind(this);
    this.boundMousemove = this._onMousemove.bind(this);
    this.boundMouseup = this._onMouseup.bind(this);
    this.boundHover = this._onHover.bind(this);
  }

  activate() {
    if (this.active) return;
    this.active = true;
    // Close any active edit - prompt mode takes over
    if (this._editingIdx >= 0) {
      this._clearEditHighlights();
      if (this.prompt) this.prompt.exitEditMode();
      this._editingIdx = -1;
    }

    enableEventIntercept();

    this._hLabel = document.createElement("div");
    this._hLabel.style.cssText = "position:fixed;pointer-events:none;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.85);font-size:11px;font-family:JustifySans,system-ui,sans-serif;font-weight:500;padding:5px 14px 5px 6px;border-radius:20px;z-index:2147483647;opacity:0;transition:opacity 80ms ease;box-shadow:0 2px 8px rgba(0,0,0,0.3);white-space:nowrap;display:flex;align-items:center;gap:6px";
    this.overlay.getContainer().appendChild(this._hLabel);

    this._selColor = "#D97757";

    this._lasso = new Lasso(this.overlay.getContainer());
    this._lasso.setColor(this._selColor);
    this._lasso.enable(function (this: PromptMode, els: Element[]) {
      if (els.length === 0) return;
      var filtered = els.filter(function (el: Element) {
        return !els.some(function (o: Element) {
          return o !== el && el.contains(o);
        });
      });
      this.multiSelect.clear();
      for (var i = 0; i < filtered.length; i++) {
        this.multiSelect.add(this.buildSelectedElement(filtered[i]));
      }
      this._lasso.clearOverlays();
      this._lasso._removeRect && this._lasso._removeRect();
      this._showSelOverlays();
      var _allL = this.multiSelect.getAll(),
        _mbL = 0,
        _mlL = Infinity;
      for (var _li = 0; _li < _allL.length; _li++) {
        var _lr = _allL[_li].domNode.getBoundingClientRect();
        if (_lr.bottom > _mbL) _mbL = _lr.bottom;
        if (_lr.left < _mlL) _mlL = _lr.left;
      }
      if (_allL.length > 0 && this.prompt) {
        this.prompt.show(_mlL, _mbL + 12);
        this.prompt.onPromptSubmit(function (this: PromptMode, a: string) {
          this.submitPrompt(a);
        }.bind(this));
      }
    }.bind(this));

    this.prompt = new InlinePrompt(this.overlay.getShadowRoot());
    this.prompt.setMarkerColor(this._selColor);
    if (!this._watchActive) this.prompt.setSendBlocked(true);

    this.prompt.onPromptQueue(function (this: PromptMode, text: string) {
      var els = this.multiSelect.getAll().map(function (s: SelectedElement) {
        return {
          domNode: s.domNode,
          selector: s.selector,
          tagName: s.tagName
        };
      });
      var newItem = {
        prompt: text,
        elements: els
      };
      this._changeQueue.push(newItem);
      this._persistQueue();
      this._updateQueueBadge();

      // If panel references are missing or stale, try to restore them
      if ((!this._queuePanel || !this._queueListEl) && this._changeQueue.length > 0) {
        this._restoreQueuePanelReferences();
      }

      // Live insert + rise-in if the queue panel is already open.
      if (this._queuePanel && this._queueListEl && this._core) {
        this._core._appendQueueRowAnimated(this._changeQueue.length - 1, newItem, this._queueListEl, this._queueHdrText, this._changeQueue.length);
      }
    }.bind(this));

    this.prompt.onAfterQueue(function (this: PromptMode) {
      this.multiSelect.clear();
      this._showSelOverlays();
      this.overlay.hideHighlight();
    }.bind(this));

    // Restore queue panel references if panel exists in DOM but refs were cleared
    this._restoreQueuePanelReferences();

    document.addEventListener("mousedown", this.boundMousedown, { capture: true });
    document.addEventListener("mousemove", this.boundMousemove, { capture: true });
    document.addEventListener("mouseup", this.boundMouseup, { capture: true });
    document.addEventListener("click", this.boundClick, { capture: true });
    document.addEventListener("mousemove", this.boundHover);

    this._boundScroll = () => {
      this.overlay.hideHighlight();
      if (this._hLabel) this._hLabel.style.opacity = "0";
      if (this._selTracked && this._selTracked.length > 0) {
        for (var _si = 0; _si < this._selTracked.length; _si++) {
          var _st = this._selTracked[_si],
            _sr = _st.el.getBoundingClientRect();
          _st.box.style.left = _sr.left + "px";
          _st.box.style.top = _sr.top + "px";
          _st.box.style.width = _sr.width + "px";
          _st.box.style.height = _sr.height + "px";
          this._positionSelLabel(_st.label, _sr);
        }
        if (this.prompt && this.prompt.isVisible()) {
          var _mb2 = -Infinity,
            _be2: Element | null = null;
          for (var _si2 = 0; _si2 < this._selTracked.length; _si2++) {
            var _sr2 = this._selTracked[_si2].el.getBoundingClientRect();
            if (_sr2.bottom > _mb2) {
              _mb2 = _sr2.bottom;
              _be2 = this._selTracked[_si2].el;
            }
          }
          if (_be2) {
            var _br2 = _be2.getBoundingClientRect();
            this.prompt.container.style.transition = "none";
            this.prompt.container.style.left = (_br2.left + _br2.width / 2 - 150) + "px";
            this.prompt.container.style.top = (_mb2 + 12) + "px";
          }
        }
      }
    };
    window.addEventListener("scroll", this._boundScroll, true);

    this._boundResize = function (this: PromptMode) {
      if (this.multiSelect.getAll().length > 0) this._showSelOverlays();
    }.bind(this);
    window.addEventListener("resize", this._boundResize);

    // Use core's persistent queuePill - never create our own
    this._actionPill = this._core?._queuePill || null;

    // Check if queue elements already exist on the pill (survives PromptMode recreation)
    const existingQueueBtn = this._actionPill?.querySelector('[data-queue-btn]') as HTMLDivElement | null;
    if (existingQueueBtn) {
      this._queueBtn = existingQueueBtn;
      this._queueCount = existingQueueBtn.querySelector('span') as HTMLSpanElement;
      this._queueLabel = this._actionPill?.querySelector('[data-queue-label]') as HTMLSpanElement;
      this._pillDivider = this._actionPill?.querySelector('[data-queue-divider]') as HTMLDivElement;
      if (this._changeQueue.length > 0 && this._queueLabel && this._queueLabel.style.width === '0px') {
        this._queueCollapsed = true;
      }
      // Re-wire pill click/hover with THIS instance's refs (old PromptMode instance is stale)
      this._wirePillHandlers();
    }

    if (!this._queueBtn) {
      this._queueBtn = document.createElement("div");
      this._queueBtn.dataset.queueBtn = '';
      this._queueBtn.style.cssText = "width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;display:none;align-items:center;justify-content:center;cursor:pointer;color:#D97757;transition:background 150ms ease,transform 0.1s;flex-shrink:0;padding:0;position:relative";

      this._queueCount = document.createElement("span");
      this._queueCount.style.cssText = "font-size:13px;font-weight:700;font-family:JustifySans,system-ui,sans-serif;font-variant-numeric:tabular-nums;pointer-events:none;line-height:1;color:#D97757";
      this._queueCount.textContent = "0";
      this._queueBtn.appendChild(this._queueCount);
      this._actionPill!.appendChild(this._queueBtn);

      this._queueLabel = document.createElement("span");
      this._queueLabel.dataset.queueLabel = '';
      this._queueLabel.style.cssText = "font-size:14px;font-weight:500;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;transition:width 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease;font-family:JustifySans,system-ui,sans-serif;display:none;cursor:pointer";
      this._queueLabel.textContent = "Queued Task";
      this._actionPill!.appendChild(this._queueLabel);

      this._actionPill!.style.cursor = "pointer";
      this._wirePillHandlers();

      this._pillDivider = document.createElement("div");
      this._pillDivider.dataset.queueDivider = '';
      this._pillDivider.style.cssText = "width:1px;height:16px;background:rgba(255,255,255,0.12);flex-shrink:0;margin:0 3px;display:none";
      this._actionPill.appendChild(this._pillDivider);
    } else {
      if (!this._queueBtn.parentNode) this.overlay.getContainer().appendChild(this._queueBtn);
    }

    this._apTip = document.createElement("div");
    this._apTip.style.cssText = "position:fixed;transform:translateX(-50%) translateY(4px);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:5px 14px;font-size:11px;font-family:JustifySans,system-ui,sans-serif;font-weight:500;color:rgba(255,255,255,0.85);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 120ms ease,transform 120ms ease;box-shadow:0 2px 8px rgba(0,0,0,0.3);z-index:2147483647";

    // pill already mounted by core
    this.overlay.getContainer().appendChild(this._apTip);

    this.onKeyDown = function (this: PromptMode, e: KeyboardEvent) {
      (e.metaKey || e.ctrlKey) && e.key === "c" && this.copyContext();
    }.bind(this);
    document.addEventListener("keydown", this.onKeyDown, true);

    // Load persisted queue on first activation
    if (this._changeQueue.length === 0) {
      this._loadPersistedQueue();
    }
  }

  deactivate() {
    this._clearEditHighlights();
    this._editingIdx = -1;
    // Always destroy prompt (edit mode creates one independently of active state)
    if (this.prompt) { this.prompt.destroy(); this.prompt = null; }
    if (!this.active) return;
    this.active = false;
    disableEventIntercept();
    this.overlay.hideHighlight();
    this._hLabel && (this._hLabel.remove(), this._hLabel = null);
    this._lasso && (this._lasso.disable(), this._lasso = null);
    this._selRaf && (cancelAnimationFrame(this._selRaf), this._selRaf = null);
    this._selTracked = [];
    this._selOverlays && (this._selOverlays.forEach(function (o: HTMLElement) {
      o.remove();
    }), this._selOverlays = []);
    this.multiSelect.clear();
    document.removeEventListener("mousedown", this.boundMousedown, { capture: true });
    document.removeEventListener("mousemove", this.boundMousemove, { capture: true });
    document.removeEventListener("mouseup", this.boundMouseup, { capture: true });
    document.removeEventListener("click", this.boundClick, { capture: true });
    document.removeEventListener("mousemove", this.boundHover);
    this._boundScroll && (window.removeEventListener("scroll", this._boundScroll, true), this._boundScroll = null);
    this._boundResize && (window.removeEventListener("resize", this._boundResize), this._boundResize = null);
    this.onKeyDown && (document.removeEventListener("keydown", this.onKeyDown, true), this.onKeyDown = null);
    this.isDragging = false;
    // Only remove buttons if queue is empty; keep them if user has pending items
    if (this._changeQueue.length === 0) {
      if (this._queueBtn?.parentNode) this._queueBtn.remove();
      if (this._pillDivider?.parentNode) this._pillDivider.remove();
      if (this._queueLabel?.parentNode) this._queueLabel.remove();
      this._queueBtn = null;
      this._queueLabel = undefined;
      this._pillDivider = undefined;
      this._queueCount = undefined;
    }
    this._actionPill = null;
  }

  _onMousedown(e: MouseEvent) {
    this.mousedownX = e.clientX;
    this.mousedownY = e.clientY;
    this.isDragging = false;
    this._mouseIsDown = true;
  }

  _onMousemove(e: MouseEvent) {
    if (!this._mouseIsDown) return;
    var dx = e.clientX - this.mousedownX,
      dy = e.clientY - this.mousedownY;
    (Math.abs(dx) > 4 || Math.abs(dy) > 4) && (this.isDragging = true);
  }

  _onMouseup(_e: MouseEvent) {
    this._mouseIsDown = false;
  }

  _onClick(e: MouseEvent) {
    if (isJustifyElement(e.target as Node)) return;
    if (e.preventDefault(), e.stopPropagation(), this.isDragging) {
      this.isDragging = false;
      return;
    }
    if (this.prompt?.isVisible()) this.prompt.hide();
    if (this._selOverlays) {
      this._selOverlays.forEach(function (o: HTMLElement) {
        o.remove();
      });
      this._selOverlays = [];
    }
    var t = getElementAtPoint(e.clientX, e.clientY);
    if (!t || t === document.documentElement || t === document.body) {
      this.multiSelect.clear();
      this.overlay.hideHighlight();
      return;
    }
    var n = this.buildSelectedElement(t);
    e.shiftKey ? this.multiSelect.toggle(n) : (this.multiSelect.clear(), this.multiSelect.add(n));
    this._showSelOverlays();
    this.overlay.trackElement(t);
    var _all = this.multiSelect.getAll(),
      _maxBot = 0,
      _botEl: Element | null = null;
    for (var _qi = 0; _qi < _all.length; _qi++) {
      var _qr = _all[_qi].domNode.getBoundingClientRect();
      if (_qr.bottom > _maxBot) {
        _maxBot = _qr.bottom;
        _botEl = _all[_qi].domNode;
      }
    }
    var _inputW = 300,
      _cx = _botEl ? _botEl.getBoundingClientRect().left + _botEl.getBoundingClientRect().width / 2 - _inputW / 2 : 0;
    this.prompt?.show(_cx, _maxBot + 12);
    this.prompt?.onPromptSubmit(function (this: PromptMode, a: string) {
      this.submitPrompt(a);
    }.bind(this));
  }

  _onHover(e: MouseEvent) {
    if (!this.active) return;
    if (isJustifyElement(e.target as Node)) {
      this.overlay.hideHighlight();
      if (this._hLabel) this._hLabel.style.opacity = "0";
      return;
    }
    var t = getElementAtPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!t || t === document.documentElement || t === document.body || t.closest && t.closest("[data-justify]") || this.multiSelect.getAll().some(function (s: SelectedElement) {
      return s.domNode === t;
    })) {
      this.overlay.hideHighlight();
      if (this._hLabel) this._hLabel.style.opacity = "0";
      return;
    }
    if (t && t !== document.documentElement && t !== document.body) {
      this.overlay.showHighlight(t.getBoundingClientRect());
      if (this._hLabel) {
        this._hLabel.innerHTML = "";

        var _tag = t.tagName.toLowerCase(),
          _role = t.getAttribute ? t.getAttribute("role") || "" : "",
          _cs = getComputedStyle(t),
          _disp = _cs.display || "";

        var _svg = createLayerIconSvg(t as Element, 14);
        this._hLabel.appendChild(_svg);

        var _cn = t.className && typeof t.className === "string" ? t.className.split(/\s+/)[0] : "",
          _lbl = _tag;
        if (_cn && _cn.length < 25) _lbl = _tag + " ." + _cn;
        else if (t.id) _lbl = _tag + " #" + t.id;
        else if (_role) _lbl = _tag + " (" + _role + ")";
        var _sp = document.createElement("span");
        _sp.textContent = _lbl;
        this._hLabel.appendChild(_sp);

        var _hlX = e.clientX + 12,
          _hlY = e.clientY - 30,
          _hlW = this._hLabel.offsetWidth || 120;
        if (_hlX + _hlW > window.innerWidth) _hlX = window.innerWidth - _hlW - 8;
        if (_hlX < 4) _hlX = 4;
        if (_hlY < 4) _hlY = e.clientY + 20;
        this._hLabel.style.left = _hlX + "px";
        this._hLabel.style.top = _hlY + "px";
        this._hLabel.style.opacity = "1";
      }
    } else {
      this.overlay.hideHighlight();
      if (this._hLabel) this._hLabel.style.opacity = "0";
    }
  }
  buildSelectedElement(e: Element | HTMLElement): SelectedElement {
    let t = generateSelector(e as HTMLElement),
      n = getComputedStylesSubset(e as HTMLElement),
      o = this.adapters.enrichElement(e as HTMLElement);
      o = this.adapters.enrichElement(e);
    return {
      domNode: e,
      selector: t,
      tagName: (e as HTMLElement).tagName.toLowerCase(),
      textContent: (e.textContent ?? "").trim(),
      classes: Array.from((e as HTMLElement).classList),
      computedStyles: n,
      boundingBox: e.getBoundingClientRect(),
      adapterData: o
    };
  }

  submitPrompt(e: string) {
    let t = this.multiSelect.getAll();
    if (t.length === 0) return;
    let o = t.map(r => {
      let s = getNearbyText(r.domNode as HTMLElement),
        a = getAccessibilityInfo(r.domNode as HTMLElement),
        l = buildElementInfo(r.domNode, r.selector, r.adapterData, r.computedStyles, s, a);
      return formatElementInfo(l);
    }).join("\n\n---\n\n");
    this.notifyPromptSent(e, t.length);
    const promptData = {
      context: o,
      prompt: e,
      elementCount: t.length,
      // Issue #1: structured selectors of the selected target(s) so the result
      // entry can scroll to + reselect them in the Changes panel.
      selectors: t.map(r => r.selector).filter(Boolean)
    };
    if (this._core) {
      this._core._lastPromptData = promptData;
      this._core._claudeState = 'sending';
      this._core._pendingResponses = 1;
      this._core._showClaudeBar('Sending to Claude', 'writing', true);
    }
    var _core = this._core;
    this.transport.request("push_prompt", promptData).catch(function (e: unknown) {
      console.warn('[Justify] Submit failed:', e);
      if (_core) _core._claudeToRetry();
    });
  }

  submitFromQueue(promptText: string, elements: { domNode: Element; selector: string; tagName: string }[]) {
    if (elements.length === 0) {
      const promptData = {
        context: 'No elements selected',
        prompt: promptText,
        elementCount: 0
      };
      if (this._core) {
        this._core._lastPromptData = promptData;
        this._core._claudeState = 'sending';
        this._core._pendingResponses = 1;
        this._core._showClaudeBar('Sending to Claude', 'writing', true);
      }
      var _core0 = this._core;
      this.transport.request("push_prompt", promptData).catch(function (e: unknown) {
        console.warn('[Justify] Submit failed:', e);
        if (_core0) _core0._claudeToRetry();
      });
      return;
    }
    let o = elements.map(r => {
      let s = getNearbyText(r.domNode as HTMLElement),
        a = getAccessibilityInfo(r.domNode as HTMLElement),
        l = buildElementInfo(r.domNode, r.selector, [], {}, s, a);
      return formatElementInfo(l);
    }).join("\n\n---\n\n");
    this.notifyPromptSent(promptText, elements.length);
    const promptData = {
      context: o,
      prompt: promptText,
      elementCount: elements.length,
      // Issue #1: structured selectors of the queued target(s).
      selectors: elements.map(r => r.selector).filter(Boolean)
    };
    if (this._core) {
      this._core._lastPromptData = promptData;
      this._core._claudeState = 'sending';
      this._core._pendingResponses = 1;
      this._core._showClaudeBar('Sending to Claude', 'writing', true);
    }
    var _core1 = this._core;
    this.transport.request("push_prompt", promptData).catch(function (e: unknown) {
      console.warn('[Justify] Submit failed:', e);
      if (_core1) _core1._claudeToRetry();
    });
  }

  onPromptSent(cb: (prompt: string, count: number) => void) {
    this.promptSentCallbacks.push(cb);
  }

  notifyPromptSent(prompt: string, count: number) {
    for (let n of this.promptSentCallbacks) n(prompt, count);
  }

  copyContext() {
    let e = this.multiSelect.getAll();
    if (e.length === 0) return;
    let t: ElementInfo[] = [],
      n: string[] = [];
    for (let r of e) {
      let s = getNearbyText(r.domNode as HTMLElement),
        a = getAccessibilityInfo(r.domNode as HTMLElement),
        l = buildElementInfo(r.domNode, r.selector, r.adapterData, r.computedStyles, s, a);
      n.push(formatElementInfo(l));
      t.push(l);
    }
    let o = n.join("\n\n---\n\n");
    copyToClipboard(o, { elements: t });
  }

  isActive(): boolean {
    return this.active;
  }

  // Position a selection label centered horizontally above its element. Keeps it
  // on-screen while the element is in view; lets it scroll off once the element
  // leaves (consistent with the box/input scroll behavior).
  _positionSelLabel(label: HTMLElement, rect: DOMRect) {
    var w = label.offsetWidth || label.getBoundingClientRect().width || 100;
    var h = label.offsetHeight || 28;
    var vpW = window.innerWidth;
    var x = rect.left + rect.width / 2 - w / 2;
    if (x < 4) x = 4;
    if (x + w > vpW - 4) x = vpW - w - 4;
    var y = rect.top - h - 6;
    if (rect.bottom > 0 && rect.top < window.innerHeight && y < 4) y = 4;
    label.style.left = x + "px";
    label.style.top = y + "px";
  }

  _showSelOverlays() {
    if (this._selOverlays) this._selOverlays.forEach(function (o: HTMLElement) {
      o.remove();
    });
    this._selOverlays = [];
    if (this._selRaf) {
      cancelAnimationFrame(this._selRaf);
      this._selRaf = null;
    }
    this._selTracked = [];
    var c = "#D97757";
    var all = this.multiSelect.getAll();
    var self = this;
    for (var i = 0; i < all.length; i++) {
      (function (idx: number) {
        var s = all[idx],
          el = s.domNode as HTMLElement,
          r = el.getBoundingClientRect();
        var o = document.createElement("div") as HTMLDivElement;
        o.style.cssText = "position:fixed;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;background:" + c + "26;border:1px solid " + c + "66;border-radius:0;pointer-events:none;z-index:2147483643";
        self.overlay.getContainer().appendChild(o);
        self._selOverlays.push(o);

        var lb = document.createElement("div") as HTMLDivElement;
        lb.style.cssText = self._showLabels !== false ? "position:fixed;left:" + (r.right + 4) + "px;top:" + r.top + "px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.85);font-size:11px;font-family:JustifySans,system-ui,sans-serif;font-weight:500;padding:4px 8px 4px 6px;border-radius:20px;pointer-events:all;z-index:2147483644;display:flex;align-items:center;gap:5px;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;cursor:default" : "position:fixed;left:" + (r.right + 4) + "px;top:" + r.top + "px;width:24px;height:24px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:50%;pointer-events:all;z-index:2147483644;display:flex;align-items:center;justify-content:center;cursor:default;box-shadow:0 2px 6px rgba(0,0,0,0.3)";

        if (self._showLabels !== false) {
          var tag = el.tagName.toLowerCase(),
            role = el.getAttribute ? el.getAttribute("role") || "" : "",
            cs2 = getComputedStyle(el),
            disp = cs2.display || "";

          var svg = createLayerIconSvg(el, 12);
          lb.appendChild(svg);

          var cn = el.className && typeof el.className === "string" ? el.className.split(/\s+/)[0] : "",
            lbl = tag;
          if (cn && cn.length < 25) lbl = tag + " ." + cn;
          else if (el.id) lbl = tag + " #" + el.id;
          else if (role) lbl = tag + " (" + role + ")";
          var sp = document.createElement("span");
          sp.textContent = lbl;
          lb.appendChild(sp);
        }

        var xb = document.createElement("button");
        // Padding grows the clickable hit area (~20px); negative margins keep the pill compact.
        xb.style.cssText = "border:none;background:none;color:#ef4444;cursor:pointer;padding:5px;margin:-5px -3px;display:flex;align-items:center;justify-content:center;font-size:0;line-height:0;border-radius:50%";

        var xs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        xs.setAttribute("width", "10");
        xs.setAttribute("height", "10");
        xs.setAttribute("viewBox", "0 0 24 24");
        xs.setAttribute("fill", "none");
        xs.setAttribute("stroke", "currentColor");
        xs.setAttribute("stroke-width", "3");
        xs.setAttribute("stroke-linecap", "round");

        var xp1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        xp1.setAttribute("d", "M18 6 6 18");
        xp1.style.cssText = "stroke-dasharray:20;stroke-dashoffset:0;transition:stroke-dashoffset 0.3s ease";
        xs.appendChild(xp1);

        var xp2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        xp2.setAttribute("d", "m6 6 12 12");
        xp2.style.cssText = "stroke-dasharray:20;stroke-dashoffset:0;transition:stroke-dashoffset 0.3s ease 0.1s";
        xs.appendChild(xp2);

        xb.addEventListener("mouseenter", function () {
          xp1.style.transition = "none";
          xp2.style.transition = "none";
          xp1.style.strokeDashoffset = "20";
          xp2.style.strokeDashoffset = "20";
          xs.getBoundingClientRect();
          xp1.style.transition = "stroke-dashoffset 0.3s ease";
          xp2.style.transition = "stroke-dashoffset 0.3s ease 0.1s";
          xp1.style.strokeDashoffset = "0";
          xp2.style.strokeDashoffset = "0";
        });

        xb.appendChild(xs);
        xb.addEventListener("click", function (ev) {
          ev.stopPropagation();
          ev.preventDefault();
          self.multiSelect.remove(s);
          self._showSelOverlays();
        });
        // Divider between the label text and the remove (x) button: ([] label | x)
        if (self._showLabels !== false) {
          var dv = document.createElement("div");
          // Full-height divider (stretches edge-to-edge via negative vertical margins
          // that cancel the pill's 4px top/bottom padding), with extra space before it.
          dv.style.cssText = "width:1px;align-self:stretch;margin:-4px 0 -4px 5px;background:rgba(255,255,255,0.1);flex:none";
          lb.appendChild(dv);
        }
        lb.appendChild(xb);

        self.overlay.getContainer().appendChild(lb);
        self._positionSelLabel(lb, r);
        self._selOverlays.push(lb);
        self._selTracked.push({ el: el, box: o, label: lb });
      })(i);
    }

    if (this._selTracked.length > 0) {
      var _update = function () {
        // Track true max-bottom (may be negative when scrolled above the viewport)
        // so the input follows the selection off-screen instead of jamming at top.
        var _mb = -Infinity,
          _ml = Infinity;
        for (var j = 0; j < self._selTracked.length; j++) {
          var tr = self._selTracked[j],
            rect = tr.el.getBoundingClientRect();
          tr.box.style.left = rect.left + "px";
          tr.box.style.top = rect.top + "px";
          tr.box.style.width = rect.width + "px";
          tr.box.style.height = rect.height + "px";
          self._positionSelLabel(tr.label, rect);
          if (rect.bottom > _mb) _mb = rect.bottom;
          if (rect.left < _ml) _ml = rect.left;
        }
        var _labels: { el: HTMLElement; top: number; left: number }[] = [];
        for (var _li = 0; _li < self._selTracked.length; _li++) {
          var _lb = self._selTracked[_li].label;
          _labels.push({
            el: _lb,
            top: parseFloat(_lb.style.top),
            left: parseFloat(_lb.style.left)
          });
        }
        _labels.sort(function (a, b) {
          return a.top - b.top || a.left - b.left;
        });
        for (var _li2 = 1; _li2 < _labels.length; _li2++) {
          var _prev = _labels[_li2 - 1],
            _curr = _labels[_li2];
          var _ph = _prev.el.offsetHeight || 24;
          if (Math.abs(_curr.left - _prev.left) < 150 && _curr.top < _prev.top + _ph + 4) {
            _curr.top = _prev.top + _ph + 4;
            _curr.el.style.top = _curr.top + "px";
          }
        }
        if (self.prompt && self.prompt.isVisible() && self._selTracked.length > 0) {
          self.prompt.container.style.transition = "none";
          var _botTr: Element | null = null,
            _botBot = -Infinity;
          for (var _bi = 0; _bi < self._selTracked.length; _bi++) {
            var _br = self._selTracked[_bi].el.getBoundingClientRect();
            if (_br.bottom > _botBot) {
              _botBot = _br.bottom;
              _botTr = self._selTracked[_bi].el;
            }
          }
          var _iwR = 300,
            _cxR = _botTr ? _botTr.getBoundingClientRect().left + _botTr.getBoundingClientRect().width / 2 - _iwR / 2 : _ml;
          self.prompt.container.style.left = _cxR + "px";
          self.prompt.container.style.top = (_mb + 12) + "px";
        }
        self._selRaf = requestAnimationFrame(_update);
      };
      self._selRaf = requestAnimationFrame(_update);
    }

    if (all.length === 0) {
      if (self.prompt && self.prompt.isVisible()) self.prompt.hide();
      self.overlay.hideHighlight();
    }
  }

  _wirePillHandlers() {
    if (!this._actionPill) return;
    this._actionPill.onmouseenter = function (this: PromptMode) {
      if (this._queueBtn && !this._queueBtn.dataset.active && this._changeQueue.length > 0) {
        this._queueBtn.style.background = "rgba(217,119,87,0.12)";
      }
    }.bind(this);
    this._actionPill.onmouseleave = function (this: PromptMode) {
      if (this._queueBtn && !this._queueBtn.dataset.active) {
        this._queueBtn.style.background = "rgba(255,255,255,0.08)";
      }
    }.bind(this);
    var pillRef = this._actionPill;
    // Close changes panel when queue panel opens
    this._actionPill.onclick = function (this: PromptMode) {
      if (this._changeQueue.length === 0) return;
      if (!this._queueCollapsed && this._queueLabel) {
        this._queueCollapsed = true;
        var labelW = this._queueLabel.offsetWidth;
        this._queueLabel.style.width = labelW + "px";
        this._queueLabel.offsetHeight;
        this._queueLabel.style.width = "0";
        this._queueLabel.style.opacity = "0";
        // Use captured ref since this._actionPill may be nulled on deactivate
        var pill = this._actionPill || pillRef;
        if (pill) {
          pill.style.gap = "0";
          pill.style.padding = "6px";
        }
      }
      this._toggleQueuePanel();
    }.bind(this);
  }

  _persistQueue() {
    // Always persist - the server is the source of truth
    var serializable = this._changeQueue.map(function (item: any) {
      return {
        prompt: item.prompt,
        elements: (item.elements || []).map(function (el: any) {
          return { selector: el.selector, tagName: el.tagName };
        })
      };
    });
    try {
      fetch('http://localhost:9223/queue', {
        method: 'POST',
        body: JSON.stringify(serializable)
      }).catch(function () {});
    } catch (e) {}
  }

  _loadPersistedQueue() {
    fetch('http://localhost:9223/queue')
      .then(function (r) { return r.json(); })
      .then(function (this: PromptMode, data: any[]) {
        if (!data || data.length === 0) return;
        for (var i = 0; i < data.length; i++) {
          var item = data[i];
          var elements = (item.elements || []).map(function (el: any) {
            var domNode: Element | null = null;
            try { domNode = document.querySelector(el.selector); } catch (e) {}
            return { domNode: domNode || document.body, selector: el.selector, tagName: el.tagName || 'div' };
          });
          this._changeQueue.push({ prompt: item.prompt, elements: elements });
        }
        this._updateQueueBadge();
      }.bind(this))
      .catch(function () {});
  }

  _updateQueueBadge() {
    var c = this._changeQueue.length;
    if (c > 0 && !this._queueBtn && this._actionPill) {
      var btn = document.createElement("div");
      btn.dataset.queueBtn = "";
      btn.style.cssText = "width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;display:flex;align-items:center;justify-content:center;color:#D97757;transition:background 150ms ease,transform 0.1s;flex-shrink:0;padding:0;position:relative";
      var count = document.createElement("span");
      count.style.cssText = "font-size:13px;font-weight:700;font-family:JustifySans,system-ui,sans-serif;font-variant-numeric:tabular-nums;pointer-events:none;line-height:1;color:#D97757";
      count.textContent = String(c);
      btn.appendChild(count);
      this._actionPill.appendChild(btn);
      var label = document.createElement("span");
      label.dataset.queueLabel = "";
      label.style.cssText = "font-size:14px;font-weight:500;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;transition:width 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease;font-family:JustifySans,system-ui,sans-serif;cursor:pointer";
      label.textContent = c === 1 ? "Queued Task" : "Queued Tasks";
      this._actionPill.appendChild(label);
      this._queueBtn = btn as any;
      this._queueCount = count;
      this._queueLabel = label;
      this._queueCollapsed = false;
      this._actionPill.style.display = "flex";
      this._actionPill.style.gap = "10px";
      this._actionPill.style.padding = "6px 18px 6px 6px";
      this._actionPill.style.opacity = "0";
      this._actionPill.style.transform = "translateX(-20px)";
      var _pill = this._actionPill;
      setTimeout(function () {
        _pill.style.opacity = "1";
        _pill.style.transform = "translateX(0)";
      }, 50);
      return;
    }
    if (this._queueCount) {
      this._queueCount.textContent = String(c);
      if (c > 0) {
        this._queueCount.animate([
          { transform: 'scale(1)' }, { transform: 'scale(1.125)' }, { transform: 'scale(1)' }
        ], { duration: 250, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
      }
    }
    if (this._queueBtn) {
      var wasHidden = this._queueBtn.style.display === "none";
      this._queueBtn.style.display = c > 0 ? "flex" : "none";
      // Slide-fade the whole pill when first item is queued
      if (c > 0 && wasHidden && this._actionPill) {
        this._actionPill.style.opacity = "0";
        this._actionPill.style.transform = "translateX(-20px)";
        this._actionPill.style.transition = "opacity 0.35s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)";
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (this._actionPill) {
              this._actionPill.style.opacity = "1";
              this._actionPill.style.transform = "translateX(0)";
            }
          }.bind(this));
        }.bind(this));
      }
    }
    // Show/hide label and set pill padding
    if (this._queueLabel) {
      if (c > 0 && !this._queueCollapsed) {
        this._queueLabel.textContent = c === 1 ? "Queued Task" : "Queued Tasks";
        this._queueLabel.style.display = "";
        this._queueLabel.style.width = "";
        this._queueLabel.style.opacity = "1";
        if (this._actionPill) {
          this._actionPill.style.gap = "10px";
          this._actionPill.style.padding = "6px 18px 6px 6px";
        }
      } else if (c === 0) {
        this._queueLabel.style.display = "none";
        this._queueLabel.style.width = "";
        this._queueLabel.style.opacity = "";
        this._queueCollapsed = false;
        if (this._actionPill) {
          this._actionPill.style.gap = "";
          this._actionPill.style.padding = "";
        }
      }
    }
    if (this._core) this._core._updateClaudeBadge();
    if (this._queuePanel) {
      if (c === 0) {
        this._queuePanel.style.transition = "opacity 0.2s ease, transform 0.2s cubic-bezier(0.4,0,0.2,1)";
        this._queuePanel.style.opacity = "0";
        this._queuePanel.style.transform = "translateY(12px)";
        var _p = this._queuePanel;
        setTimeout(function () {
          _p.remove();
        }, 200);
        this._queuePanel = null; this._queueListEl = null; this._queueHdrText = null;
        // Reset active state
        if (this._queueBtn) {
          this._queueBtn.style.background = "rgba(255,255,255,0.08)";
          this._queueBtn.style.color = "rgba(255,255,255,0.65)";
          if (this._queueCount) this._queueCount.style.color = "#D97757";
          delete this._queueBtn.dataset.active;
        }
      } else if (this._queueHdrText) {
        // Panel is open and queue has items. Update only the header count.
        // Row mutations are handled by the call site (e.g. _appendQueueRowAnimated
        // on add, or the destroy-rebuild flow inside _confirmRemoveItem on delete).
        this._queueHdrText.textContent = "Queued " + (c === 1 ? "Task" : "Tasks") + " (" + c + ")";
      }
    }
  }

  _showApTip(text: string, btn: HTMLElement) {
    if (!this._apTip || this._showHints === false) return;
    this._apTip.textContent = text;
    var r = btn.getBoundingClientRect();
    this._apTip.style.left = r.left + r.width / 2 + "px";
    this._apTip.style.top = r.top - this._apTip.offsetHeight - 8 + "px";
    this._apTip.style.opacity = "1";
    this._apTip.style.transform = "translateX(-50%) translateY(0)";
  }

  _hideApTip() {
    if (!this._apTip) return;
    this._apTip.style.opacity = "0";
    this._apTip.style.transform = "translateX(-50%) translateY(4px)";
  }

  _restoreQueuePanelReferences() {
    // If references are already set and valid, nothing to restore
    if (this._queuePanel && this._queueListEl && this._queuePanel.parentNode) return;

    // Search for existing queue panel using data attribute
    const container = this.overlay.getContainer();
    const existingPanel = container.querySelector('[data-justify-queue-panel]') as HTMLDivElement;

    if (existingPanel) {
      this._queuePanel = existingPanel;

      // Find list element (second div child with max-height style) and header span
      const children = existingPanel.querySelectorAll('div');
      let listWrap: HTMLDivElement | null = null;

      for (let i = 0; i < children.length; i++) {
        if (children[i].style.maxHeight === '240px' || children[i].style.maxHeight === '240px') {
          listWrap = children[i] as HTMLDivElement;
          break;
        }
      }

      // Fallback: just get the second div if we can't find by style
      if (!listWrap && children.length > 1) {
        listWrap = children[1] as HTMLDivElement;
      }

      if (listWrap) {
        this._queueListEl = listWrap;

        // Check if list is stale (missing items). If so, rebuild it.
        const itemCount = listWrap.querySelectorAll('[data-queue-row]').length;
        if (itemCount !== this._changeQueue.length && this._core) {
          // Clear and rebuild list with all current items
          while (listWrap.firstChild) listWrap.removeChild(listWrap.firstChild);
          for (var i = 0; i < this._changeQueue.length; i++) {
            listWrap.appendChild(this._core._buildQueueRow(i, this._changeQueue[i], i === this._changeQueue.length - 1));
          }
        }
      }

      // Find and restore header text element
      const headerSpans = existingPanel.querySelectorAll('span');
      if (headerSpans.length > 0) {
        this._queueHdrText = headerSpans[0] as HTMLSpanElement;
      }
    }
  }

  _toggleQueuePanel() {
    // Close changes panel if open
    if (this._core && (this._core as any)._changesPanel?.isVisible()) {
      (this._core as any)._changesPanel.hide();
    }

    if (this._queuePanel) {
      var _p = this._queuePanel;
      _p.style.transition = "opacity 0.2s ease, transform 0.2s cubic-bezier(0.4,0,0.2,1)";
      _p.style.opacity = "0";
      _p.style.transform = "translateY(12px)";
      setTimeout(function () { _p.remove(); }, 220);
      this._queuePanel = null; this._queueListEl = null; this._queueHdrText = null;
      if (this._queueBtn) {
        this._queueBtn.style.background = "rgba(255,255,255,0.08)";
        this._queueBtn.style.color = "#D97757";
        if (this._queueCount) this._queueCount.style.color = "#D97757";
        delete this._queueBtn.dataset.active;
      }
      return;
    }
    var p = document.createElement("div");
    p.dataset.justifyQueuePanel = "true";
    p.style.cssText = "position:fixed;bottom:72px;left:20px;width:340px;max-height:400px;overflow:hidden;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.5);padding:0;display:flex;flex-direction:column;z-index:2147483647;pointer-events:all;font-family:JustifySans,system-ui,sans-serif;opacity:0;transform:translateY(12px);transition:opacity 0.25s ease,transform 0.25s cubic-bezier(0.4,0,0.2,1)";

    var hdr = document.createElement("div");
    hdr.style.cssText = "font-size:12px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.03em;text-transform:uppercase;padding:14px 16px 10px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between";

    var hdrText = document.createElement("span");
    hdrText.textContent = "Queued " + (this._changeQueue.length === 1 ? "Task" : "Tasks") + " (" + this._changeQueue.length + ")";
    hdr.appendChild(hdrText);
    this._queueHdrText = hdrText;

    var hdrClose = document.createElement("button");
    hdrClose.style.cssText = "border:none;background:transparent;color:rgba(255,255,255,0.5);cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;transition:background 120ms ease,color 120ms ease";

    var _xcSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    _xcSvg.setAttribute("width", "14");
    _xcSvg.setAttribute("height", "14");
    _xcSvg.setAttribute("viewBox", "0 0 24 24");
    _xcSvg.setAttribute("fill", "none");
    _xcSvg.setAttribute("stroke", "currentColor");
    _xcSvg.setAttribute("stroke-width", "2.5");
    _xcSvg.setAttribute("stroke-linecap", "round");

    var _xcp1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    _xcp1.setAttribute("d", "M18 6 6 18");
    _xcSvg.appendChild(_xcp1);

    var _xcp2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    _xcp2.setAttribute("d", "m6 6 12 12");
    _xcSvg.appendChild(_xcp2);

    hdrClose.appendChild(_xcSvg);

    hdrClose.addEventListener("mouseenter", function () {
      hdrClose.style.background = "rgba(255,255,255,0.08)";
      hdrClose.style.color = "rgba(255,255,255,0.85)";
    });
    hdrClose.addEventListener("mouseleave", function () {
      hdrClose.style.background = "transparent";
      hdrClose.style.color = "rgba(255,255,255,0.5)";
    });
    hdrClose.addEventListener("click", function (this: PromptMode) {
      this._toggleQueuePanel();
    }.bind(this));

    hdr.appendChild(hdrClose);
    p.appendChild(hdr);

    var listWrap = document.createElement("div");
    listWrap.style.cssText = "padding:10px 15px;max-height:240px;overflow-y:auto";

    for (var i = 0; i < this._changeQueue.length; i++) {
      if (this._core) {
        listWrap.appendChild(this._core._buildQueueRow(i, this._changeQueue[i], i === this._changeQueue.length - 1));
      }
    }

    p.appendChild(listWrap);
    this._queueListEl = listWrap;

    // Connection alert banner (shown when Claude is not connected)
    var alertBanner = document.createElement("div");
    alertBanner.dataset.watchAlert = '';
    alertBanner.style.cssText = "margin:0 16px 12px;padding:12px 14px;background:rgba(217,119,87,0.08);border:1px solid rgba(217,119,87,0.2);border-radius:10px;box-shadow:0px -10px 25px 10px #1a1a1a;transition:opacity 0.2s ease,transform 0.2s ease,margin 0.2s ease";
    if (this._watchActive) {
      alertBanner.style.opacity = "0";
      alertBanner.style.height = "0";
      alertBanner.style.margin = "0";
      alertBanner.style.padding = "0";
      alertBanner.style.overflow = "hidden";
    }
    var alertIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    alertIcon.setAttribute("width", "14");
    alertIcon.setAttribute("height", "14");
    alertIcon.setAttribute("viewBox", "0 0 24 24");
    alertIcon.setAttribute("fill", "none");
    alertIcon.setAttribute("stroke", "#D97757");
    alertIcon.setAttribute("stroke-width", "2");
    alertIcon.setAttribute("stroke-linecap", "round");
    alertIcon.setAttribute("stroke-linejoin", "round");
    alertIcon.style.cssText = "flex-shrink:0;margin-right:6px;vertical-align:middle;display:inline-block";
    var alertIconCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    alertIconCircle.setAttribute("cx", "12");
    alertIconCircle.setAttribute("cy", "12");
    alertIconCircle.setAttribute("r", "10");
    alertIcon.appendChild(alertIconCircle);
    var alertIconLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    alertIconLine.setAttribute("d", "M12 16h.01");
    alertIcon.appendChild(alertIconLine);
    var alertIconLine2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    alertIconLine2.setAttribute("d", "M12 8v4");
    alertIcon.appendChild(alertIconLine2);

    var alertTitle = document.createElement("div");
    alertTitle.style.cssText = "font-size:13px;font-weight:700;font-family:JustifySans,system-ui,sans-serif;color:rgba(255,255,255,0.85);margin-bottom:8px;display:flex;align-items:center";
    alertTitle.appendChild(alertIcon);
    alertTitle.appendChild(document.createTextNode("Claude is not connected"));
    alertBanner.appendChild(alertTitle);
    var alertBody = document.createElement("div");
    alertBody.style.cssText = "font-size:11px;font-family:JustifySans,system-ui,sans-serif;color:rgba(255,255,255,0.6);line-height:1.4";
    alertBody.appendChild(document.createTextNode('Tell Claude '));
    var alertCode = document.createElement("span");
    alertCode.style.cssText = "font-family:JustifyMono,ui-monospace,monospace;font-size:11px;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;color:rgba(255,255,255,0.8)";
    alertCode.textContent = "watch justify";
    alertBody.appendChild(alertCode);
    alertBody.appendChild(document.createTextNode(' to start receiving tasks.'));
    alertBanner.appendChild(alertBody);
    p.appendChild(alertBanner);

    // Send All / Clear All buttons inside panel
    var panelActions = document.createElement("div");
    panelActions.style.cssText = "padding:12px 16px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px";

    var clearAllBtn = document.createElement("button");
    clearAllBtn.style.cssText = "flex:1;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.65);font-family:JustifySans,system-ui,sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:background 0.15s,color 0.15s,border-color 0.15s";
    clearAllBtn.textContent = "Clear All";
    clearAllBtn.addEventListener("mouseenter", function () {
      clearAllBtn.style.background = "rgba(255,255,255,0.08)";
      clearAllBtn.style.color = "rgba(255,255,255,0.85)";
      clearAllBtn.style.borderColor = "rgba(255,255,255,0.18)";
    });
    clearAllBtn.addEventListener("mouseleave", function () {
      clearAllBtn.style.background = "rgba(255,255,255,0.04)";
      clearAllBtn.style.color = "rgba(255,255,255,0.65)";
      clearAllBtn.style.borderColor = "rgba(255,255,255,0.12)";
    });
    clearAllBtn.addEventListener("click", function (this: PromptMode) {
      // Discarding all tasks: revert any Manipulate live previews to original.
      if (this._changeQueue.some(function (it: any) { return it && it._manipulate; })) {
        (this._core as any)?.revertManipulatePreview();
      }
      this._changeQueue.length = 0;
      this._persistQueue();
      // Slide-fade panel out
      if (this._queuePanel) {
        this._queuePanel.style.transition = "opacity 0.2s ease, transform 0.2s cubic-bezier(0.4,0,0.2,1)";
        this._queuePanel.style.opacity = "0";
        this._queuePanel.style.transform = "translateY(12px)";
        var _p = this._queuePanel;
        setTimeout(function () { _p.remove(); }, 220);
        this._queuePanel = null; this._queueListEl = null; this._queueHdrText = null;
        if (this._queueBtn) {
          this._queueBtn.style.background = "rgba(255,255,255,0.08)";
          this._queueBtn.style.color = "#D97757";
          if (this._queueCount) this._queueCount.style.color = "#D97757";
          delete this._queueBtn.dataset.active;
        }
      }
      // Fade pill out and clean up queue UI elements
      if (this._actionPill) {
        this._actionPill.style.opacity = "0";
        this._actionPill.style.transform = "scale(0.9)";
        var pill = this._actionPill;
        var qBtn = this._queueBtn;
        var qLabel = this._queueLabel;
        setTimeout(function () {
          pill.style.display = "none";
          // Remove queue UI elements so empty pill doesn't persist
          if (qBtn && qBtn.parentNode) qBtn.remove();
          if (qLabel && qLabel.parentNode) qLabel.remove();
        }, 260);
        this._queueBtn = null;
        this._queueLabel = undefined;
        this._queueCount = undefined;
        this._queueCollapsed = false;
      }
      setTimeout(function (this: PromptMode) { this._updateQueueBadge(); }.bind(this), 280);
    }.bind(this));
    panelActions.appendChild(clearAllBtn);

    var sendAllBtn = document.createElement("button");
    sendAllBtn.style.cssText = "flex:1;height:36px;border-radius:8px;border:1px solid rgba(217,119,87,0.25);background:rgba(217,119,87,0.1);color:#D97757;font-family:JustifySans,system-ui,sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:background 0.15s,color 0.15s,border-color 0.15s";
    sendAllBtn.textContent = "Send All";
    if (!this._watchActive) sendAllBtn.style.display = "none";
    this._sendAllBtn = sendAllBtn;
    sendAllBtn.addEventListener("mouseenter", function () {
      sendAllBtn.style.background = "rgba(217,119,87,0.18)";
      sendAllBtn.style.color = "#e8906e";
      sendAllBtn.style.borderColor = "rgba(217,119,87,0.35)";
    });
    sendAllBtn.addEventListener("mouseleave", function () {
      sendAllBtn.style.background = "rgba(217,119,87,0.1)";
      sendAllBtn.style.color = "#D97757";
      sendAllBtn.style.borderColor = "rgba(217,119,87,0.25)";
    });
    sendAllBtn.addEventListener("click", function (this: PromptMode) {
      if (this._changeQueue.length > 0) {
        var _cnt = this._changeQueue.length;
        // Set pending count BEFORE the loop so responses wait for all tasks
        if (this._core) this._core._pendingResponses = this._changeQueue.length;
        for (var qi = 0; qi < this._changeQueue.length; qi++) {
          this.submitFromQueue(this._changeQueue[qi].prompt, this._changeQueue[qi].elements);
        }
        this._changeQueue.length = 0;
        this._persistQueue();
        // Slide-fade panel out
        if (this._queuePanel) {
          this._queuePanel.style.transition = "opacity 0.2s ease, transform 0.2s cubic-bezier(0.4,0,0.2,1)";
          this._queuePanel.style.opacity = "0";
          this._queuePanel.style.transform = "translateY(12px)";
          var _p = this._queuePanel;
          setTimeout(function () { _p.remove(); }, 220);
          this._queuePanel = null; this._queueListEl = null; this._queueHdrText = null;
          if (this._queueBtn) {
            this._queueBtn.style.background = "rgba(255,255,255,0.08)";
            this._queueBtn.style.color = "#D97757";
            if (this._queueCount) this._queueCount.style.color = "#D97757";
            delete this._queueBtn.dataset.active;
          }
        }
        // Fade pill out and clean up queue UI elements
        if (this._actionPill) {
          this._actionPill.style.opacity = "0";
          this._actionPill.style.transform = "scale(0.9)";
          var pill = this._actionPill;
          var qBtn = this._queueBtn;
          var qLabel = this._queueLabel;
          setTimeout(function () {
            pill.style.display = "none";
            if (qBtn && qBtn.parentNode) qBtn.remove();
            if (qLabel && qLabel.parentNode) qLabel.remove();
          }, 260);
          this._queueBtn = null;
          this._queueLabel = undefined;
          this._queueCount = undefined;
          this._queueCollapsed = false;
        }
        setTimeout(function (this: PromptMode) { this._updateQueueBadge(); }.bind(this), 280);
      }
    }.bind(this));
    panelActions.appendChild(sendAllBtn);

    p.appendChild(panelActions);

    this._queuePanel = p;
    this._queueBtn!.style.background = "#D97757";
    this._queueBtn!.style.color = "#fff";
    if (this._queueCount) this._queueCount.style.color = "#fff";
    this._queueBtn!.dataset.active = "1";
    this.overlay.getContainer().appendChild(p);

    // Slide-fade in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        p.style.opacity = "1";
        p.style.transform = "translateY(0)";
      });
    });
  }


  _confirmRemoveItem(idx: number) {
    var item = this._changeQueue[idx];
    var d = document.createElement("div");
    d.dataset.justify = "";
    d.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2147483648;display:flex;align-items:center;justify-content:center;pointer-events:all;opacity:0;transition:opacity 160ms ease";

    var box = document.createElement("div");
    // Symmetrical, centered card: centered message + equal-width buttons, even
    // padding all round, with an entrance pop.
    box.style.cssText = "background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:22px;width:300px;max-width:calc(100vw - 40px);box-sizing:border-box;font-family:JustifySans,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,0.55);text-align:center;opacity:0;transform:scale(0.94);transition:opacity 160ms ease,transform 180ms cubic-bezier(0.34,1.56,0.64,1)";

    var msg = document.createElement("div");
    msg.style.cssText = "font-size:13px;line-height:1.5;color:rgba(255,255,255,0.85);margin:0 0 18px";
    msg.textContent = 'Remove "' + item.prompt.slice(0, 40) + (item.prompt.length > 40 ? "..." : "") + '"?';
    box.appendChild(msg);

    var btns = document.createElement("div");
    btns.style.cssText = "display:flex;gap:10px";

    function _cleanup() { document.removeEventListener("keydown", _onKey, true); }
    function _close() {
      d.style.opacity = "0";
      box.style.opacity = "0";
      box.style.transform = "scale(0.94)";
      _cleanup();
      setTimeout(function () { d.remove(); }, 170);
    }
    function _onKey(e: KeyboardEvent) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); _close(); } }

    var cancel = document.createElement("button");
    cancel.style.cssText = "flex:1;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.02);color:rgba(255,255,255,0.7);border-radius:9px;padding:9px 14px;font-size:12px;font-weight:500;cursor:pointer;font-family:JustifySans,system-ui,sans-serif;outline:none;transition:background 120ms ease,border-color 120ms ease,color 120ms ease,transform 80ms ease";
    cancel.textContent = "Cancel";
    cancel.addEventListener("mouseenter", function () { cancel.style.background = "rgba(255,255,255,0.08)"; cancel.style.borderColor = "rgba(255,255,255,0.3)"; cancel.style.color = "#fff"; });
    cancel.addEventListener("mouseleave", function () { cancel.style.background = "rgba(255,255,255,0.02)"; cancel.style.borderColor = "rgba(255,255,255,0.15)"; cancel.style.color = "rgba(255,255,255,0.7)"; });
    cancel.addEventListener("mousedown", function () { cancel.style.transform = "scale(0.96)"; });
    cancel.addEventListener("mouseup", function () { cancel.style.transform = "scale(1)"; });
    cancel.addEventListener("click", function () { _close(); });
    btns.appendChild(cancel);

    var confirmBtn = document.createElement("button");
    confirmBtn.style.cssText = "flex:1;border:none;background:#ef4444;color:#fff;border-radius:9px;padding:9px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:JustifySans,system-ui,sans-serif;outline:none;transition:background 120ms ease,box-shadow 120ms ease,transform 80ms ease";
    confirmBtn.textContent = "Remove";
    confirmBtn.addEventListener("mouseenter", function () { confirmBtn.style.background = "#dc2626"; confirmBtn.style.boxShadow = "0 4px 14px rgba(239,68,68,0.45)"; });
    confirmBtn.addEventListener("mouseleave", function () { confirmBtn.style.background = "#ef4444"; confirmBtn.style.boxShadow = "none"; });
    confirmBtn.addEventListener("mousedown", function () { confirmBtn.style.transform = "scale(0.96)"; });
    confirmBtn.addEventListener("mouseup", function () { confirmBtn.style.transform = "scale(1)"; });
    confirmBtn.addEventListener("click", function (this: PromptMode) {
      _cleanup();
      d.remove();
      this._changeQueue.splice(idx, 1);
      // Discarding a Manipulate task: revert its live preview to the original look.
      if ((item as any)?._manipulate && (item as any).elements?.[0]?.selector) {
        (this._core as any)?.revertManipulatePreview((item as any).elements[0].selector);
      }
      this._persistQueue();
      this._updateQueueBadge();
      if (this._queuePanel) {
        if (this._changeQueue.length === 0) {
          this._queuePanel.style.transition = "opacity 0.2s ease";
          this._queuePanel.style.opacity = "0";
          var _p = this._queuePanel;
          setTimeout(function () {
            _p.remove();
          }, 200);
          this._queuePanel = null; this._queueListEl = null; this._queueHdrText = null;
        } else {
          this._queuePanel.remove();
          this._queuePanel = null; this._queueListEl = null; this._queueHdrText = null;
          this._toggleQueuePanel();
        }
      }
    }.bind(this));
    btns.appendChild(confirmBtn);
    box.appendChild(btns);
    d.appendChild(box);
    // Dismiss on backdrop click (the overlay itself, never the box) + Escape.
    d.addEventListener("mousedown", function (e: MouseEvent) { if (e.target === d) _close(); });
    document.addEventListener("keydown", _onKey, true);
    this.overlay.getContainer().appendChild(d);
    // Entrance pop.
    requestAnimationFrame(function () { d.style.opacity = "1"; box.style.opacity = "1"; box.style.transform = "scale(1)"; });
  }

  _editQueueItem(idx: number) {
    var item = this._changeQueue[idx];
    if (!item) return;
    // Deactivate prompt mode if active (edit mode is independent)
    if (this.active) this.deactivate();
    if (this._queuePanel) {
      this._queuePanel.remove();
      this._queuePanel = null; this._queueListEl = null; this._queueHdrText = null;
    }

    // Create InlinePrompt directly if needed (no full prompt mode activation)
    if (!this.prompt) {
      this.prompt = new InlinePrompt(this.overlay.getShadowRoot());
      this.prompt.setMarkerColor(this._selColor);
      if (!this._watchActive) this.prompt.setSendBlocked(true);
    }

    // Scroll the first target element to vertical center of viewport
    var scrollTarget: HTMLElement | null = null;
    for (var si = 0; si < item.elements.length; si++) {
      var sn = item.elements[si].domNode as HTMLElement;
      if (sn && document.contains(sn)) { scrollTarget = sn; break; }
    }
    if (scrollTarget) {
      var sr = scrollTarget.getBoundingClientRect();
      var targetCenter = sr.top + sr.height / 2;
      var viewCenter = window.innerHeight / 2;
      window.scrollBy({ top: targetCenter - viewCenter, behavior: 'instant' as ScrollBehavior });
    }

    // Highlight target elements using the standard selection overlay style
    this._clearEditHighlights();
    var posEl: HTMLElement | null = null;
    var c = "#D97757";
    var container = this.overlay.getContainer();
    for (var i = 0; i < item.elements.length; i++) {
      var domNode = item.elements[i].domNode as HTMLElement;
      if (!domNode || !document.contains(domNode)) continue;
      if (!posEl) posEl = domNode;
      var rect = domNode.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;background:' + c + '26;border:2px solid ' + c + '66;border-radius:5px;pointer-events:none;z-index:2147483643';
      container.appendChild(box);
      this._editOverlays.push(box);

      var tag = domNode.tagName.toLowerCase();
      var role = domNode.getAttribute ? domNode.getAttribute('role') || '' : '';
      var cs = getComputedStyle(domNode);
      var disp = cs.display || '';

      var lb = document.createElement('div');
      lb.style.cssText = 'position:fixed;left:' + (rect.right + 4) + 'px;top:' + rect.top + 'px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.85);font-size:11px;font-family:JustifySans,system-ui,sans-serif;font-weight:500;padding:4px 10px 4px 10px;border-radius:20px;pointer-events:none;z-index:2147483644;display:flex;align-items:center;gap:5px;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;cursor:default';

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '12'); svg.setAttribute('height', '12');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
      var iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      iconPath.setAttribute('d', getElementIcon(tag, role, disp));
      svg.appendChild(iconPath);
      lb.appendChild(svg);

      var cn = domNode.className && typeof domNode.className === 'string' ? domNode.className.split(/\s+/)[0] : '';
      var lbl = tag;
      if (cn && cn.length < 25) lbl = tag;
      else if (domNode.id) lbl = tag + ' #' + domNode.id;
      else if (role) lbl = tag + ' (' + role + ')';
      var sp = document.createElement('span');
      sp.textContent = lbl;
      lb.appendChild(sp);

      container.appendChild(lb);
      this._editOverlays.push(lb);
      this._editTracked.push({ el: domNode, box: box, label: lb });
    }

    // Start rAF tracking for scroll (highlights + input, transition already killed)
    if (this._editTracked.length > 0) {
      var self = this;
      var promptContainer = this.prompt ? this.prompt.container : null;
      var trackEdit = function () {
        var anyVisible = false;
        var firstR: DOMRect | null = null;
        for (var j = 0; j < self._editTracked.length; j++) {
          var tr = self._editTracked[j];
          var r = tr.el.getBoundingClientRect();
          var inView = r.bottom > 0 && r.top < window.innerHeight;
          tr.box.style.display = inView ? '' : 'none';
          tr.label.style.display = inView ? 'flex' : 'none';
          if (!inView) continue;
          anyVisible = true;
          if (!firstR) firstR = r;
          tr.box.style.left = r.left + 'px';
          tr.box.style.top = r.top + 'px';
          tr.box.style.width = r.width + 'px';
          tr.box.style.height = r.height + 'px';
          var lbX = r.right + 4;
          var lbW = tr.label.offsetWidth || 100;
          if (lbX + lbW > window.innerWidth - 4) lbX = r.left - lbW - 4;
          if (lbX < 4) lbX = 4;
          tr.label.style.left = lbX + 'px';
          tr.label.style.top = r.top + 'px';
        }
        if (promptContainer) {
          if (anyVisible && firstR) {
            promptContainer.style.display = 'flex';
            promptContainer.style.left = (firstR.left + firstR.width / 2 - 150) + 'px';
            promptContainer.style.top = (firstR.bottom + 12) + 'px';
          } else {
            promptContainer.style.display = 'none';
          }
        }
        self._editRaf = requestAnimationFrame(trackEdit);
      };
      this._editRaf = requestAnimationFrame(trackEdit);
    }

    this._editingIdx = idx;
    if (posEl) {
      var pr = posEl.getBoundingClientRect();
      this.prompt.show(pr.left + pr.width / 2 - 150, pr.bottom + 12);
    } else {
      this.prompt.show(window.innerWidth / 2 - 150, window.innerHeight / 2);
    }
    this.prompt.container.style.transition = 'none';
    var _prompt = this.prompt;
    setTimeout(function () {
      _prompt.input.value = item.prompt;
      _prompt.input.dispatchEvent(new Event("input"));
    }, 50);
    this.prompt.enterEditMode(idx, this);
  }

  _clearEditHighlights() {
    if (this._editRaf) { cancelAnimationFrame(this._editRaf); this._editRaf = null; }
    this._editOverlays.forEach(function (o) { o.remove(); });
    this._editOverlays = [];
    this._editTracked = [];
  }

  _updateActionButtons() {
    var has = this._changeQueue.length > 0;
    if (this._queueLabel) {
      if (has && !this._queueCollapsed) {
        this._queueLabel.style.display = "";
      } else if (!has) {
        this._queueLabel.style.display = "none";
        this._queueCollapsed = false;
      }
    }
  }

  setColorGetter(fn: () => string) {
    this._getColor = fn;
  }

  setWatchActive(active: boolean) {
    this._watchActive = active;
    if (this.prompt) this.prompt.setSendBlocked(!active);
    if (this._sendAllBtn) {
      this._sendAllBtn.style.display = active ? '' : 'none';
    }
    // Toggle alert banner in queue panel if open
    if (this._queuePanel) {
      var alert = this._queuePanel.querySelector('[data-watch-alert]') as HTMLElement;
      if (alert) {
        if (active) {
          alert.style.opacity = "0";
          alert.style.transform = "translateY(8px)";
          setTimeout(function () { alert.style.height = "0"; alert.style.margin = "0"; alert.style.padding = "0"; alert.style.overflow = "hidden"; }, 200);
        } else {
          alert.style.height = "";
          // Restore the real inset margin explicitly. If the panel was created
          // while watch was active, the collapse path set inline margin to "0";
          // clearing it with "" would fall back to 0 (no stylesheet rule), making
          // the banner span the full panel width on first reveal. Match the base
          // cssText (and the task row / action buttons) at 16px gutters.
          alert.style.margin = "0 16px 12px";
          alert.style.padding = "12px 14px";
          alert.style.overflow = "";
          requestAnimationFrame(function () { alert.style.opacity = "1"; alert.style.transform = "translateY(0)"; });
        }
      }
    }
  }
}
