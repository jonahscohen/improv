import { InlinePrompt } from './inline-prompt';
import { MultiSelect, SelectedElement } from './multi-select';

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

export function isEndowElement(node: Node | null): boolean {
  if (!node) return false;
  let e: Node | null = node;
  for (; e;) {
    if (e instanceof HTMLElement && e.hasAttribute("data-endow")) return true;
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
  _selColor: string = "#3b82f6";
  _selOverlays: HTMLElement[] = [];
  _getColor: (() => string) | null = null;
  mousedownX: number = 0;
  mousedownY: number = 0;
  isDragging: boolean = false;
  _queuePanel: HTMLDivElement | null = null;
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
  _actionPill?: HTMLDivElement;
  _queueCount?: HTMLSpanElement;
  _pillDivider?: HTMLDivElement;
  _sendAllBtn?: HTMLDivElement;
  _clearAllBtn?: HTMLDivElement;
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

    (window as any).__endow_enablePointerBlock();

    this._hLabel = document.createElement("div");
    this._hLabel.style.cssText = "position:fixed;pointer-events:none;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.85);font-size:11px;font-family:system-ui,sans-serif;font-weight:500;padding:5px 14px;border-radius:20px;z-index:2147483647;opacity:0;transition:opacity 80ms ease;box-shadow:0 2px 8px rgba(0,0,0,0.3);white-space:nowrap;display:flex;align-items:center;gap:6px";
    this.overlay.getContainer().appendChild(this._hLabel);

    this._selColor = this._getColor ? this._getColor() : "#3b82f6";

    this._lasso = new (window as any).__endow_LassoSelect(this.overlay.getContainer());
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

    this.prompt.onPromptQueue(function (this: PromptMode, text: string) {
      var els = this.multiSelect.getAll().map(function (s: SelectedElement) {
        return {
          domNode: s.domNode,
          selector: s.selector,
          tagName: s.tagName
        };
      });
      this._changeQueue.push({
        prompt: text,
        elements: els
      });
      this._updateQueueBadge();
    }.bind(this));

    this.prompt.onAfterQueue(function (this: PromptMode) {
      this.multiSelect.clear();
      this._showSelOverlays();
      this.overlay.hideHighlight();
    }.bind(this));

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
          var _lbX = _sr.right + 4,
            _lbW = _st.label.offsetWidth || 100;
          if (_lbX + _lbW > window.innerWidth) _lbX = _sr.left - _lbW - 4;
          if (_lbX < 4) _lbX = 4;
          _st.label.style.left = _lbX + "px";
          _st.label.style.top = _sr.top + "px";
        }
        if (this.prompt && this.prompt.isVisible()) {
          var _mb2 = 0,
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

    if (this._actionPill) {
      this._actionPill.remove();
    }

    this._actionPill = document.createElement("div");
    this._actionPill.style.cssText = "position:fixed;bottom:20px;left:20px;display:none;align-items:center;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:22px;padding:6px;gap:2px;box-shadow:0 2px 12px rgba(0,0,0,0.4);pointer-events:all;z-index:2147483647;opacity:0;transform:scale(0);transition:transform 250ms cubic-bezier(0.23,1,0.32,1),opacity 200ms ease";

    if (!this._queueBtn) {
      this._queueBtn = document.createElement("div");
      this._queueBtn.style.cssText = "width:32px;height:32px;border-radius:50%;background:transparent;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.65);transition:background 120ms ease;flex-shrink:0;padding:0;position:relative";

      this._queueBtn.addEventListener("mouseenter", function (this: PromptMode) {
        if (this._queueBtn!.dataset.active) return;
        this._queueBtn!.style.background = (this._selColor || "#3b82f6") + "33";
        this._queueBtn!.style.color = this._selColor || "#3b82f6";
        this._showApTip("Queue", this._queueBtn!);
      }.bind(this));

      this._queueBtn.addEventListener("mouseleave", function (this: PromptMode) {
        if (!this._queueBtn!.dataset.active) {
          this._queueBtn!.style.background = "transparent";
          this._queueBtn!.style.color = "rgba(255,255,255,0.65)";
        }
        this._hideApTip();
      }.bind(this));

      this._queueBtn.addEventListener("click", function (this: PromptMode) {
        this._toggleQueuePanel();
      }.bind(this));

      this._queueCount = document.createElement("span");
      this._queueCount.style.cssText = "font-size:13px;font-weight:700;font-family:system-ui,sans-serif;font-variant-numeric:tabular-nums;pointer-events:none;line-height:1";
      this._queueCount.textContent = "0";
      this._queueBtn.appendChild(this._queueCount);
      this._actionPill.appendChild(this._queueBtn);

      this._pillDivider = document.createElement("div");
      this._pillDivider.style.cssText = "width:1px;height:16px;background:rgba(255,255,255,0.12);flex-shrink:0;margin:0 3px;display:none";
      this._actionPill.appendChild(this._pillDivider);
    } else {
      if (!this._queueBtn.parentNode) this.overlay.getContainer().appendChild(this._queueBtn);
    }

    this._sendAllBtn = document.createElement("div");
    this._sendAllBtn.style.cssText = "width:32px;height:32px;border-radius:50%;background:transparent;border:none;display:none;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.65);transition:background 120ms ease;flex-shrink:0;padding:0";

    var _saSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    _saSvg.setAttribute("width", "20");
    _saSvg.setAttribute("height", "20");
    _saSvg.setAttribute("viewBox", "0 0 24 24");
    _saSvg.setAttribute("fill", "none");
    _saSvg.setAttribute("stroke", "currentColor");
    _saSvg.setAttribute("stroke-width", "2");
    _saSvg.setAttribute("stroke-linecap", "round");
    _saSvg.setAttribute("stroke-linejoin", "round");

    var _sap = document.createElementNS("http://www.w3.org/2000/svg", "path");
    _sap.setAttribute("d", "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z");
    _saSvg.appendChild(_sap);

    var _sal = document.createElementNS("http://www.w3.org/2000/svg", "line");
    _sal.setAttribute("x1", "21.854");
    _sal.setAttribute("y1", "2.147");
    _sal.setAttribute("x2", "10.914");
    _sal.setAttribute("y2", "13.086");
    _saSvg.appendChild(_sal);
    this._sendAllBtn.appendChild(_saSvg);

    this._sendAllBtn.addEventListener("mouseenter", function (this: PromptMode) {
      this._sendAllBtn!.style.background = (this._selColor || "#3b82f6") + "33";
      this._sendAllBtn!.style.color = this._selColor || "#3b82f6";
      _saSvg.style.animation = "endow-icon-hover-nudge 0.7s cubic-bezier(0.23,1,0.32,1)";
      this._showApTip("Send All", this._sendAllBtn!);
    }.bind(this));

    this._sendAllBtn.addEventListener("mouseleave", function (this: PromptMode) {
      this._sendAllBtn!.style.background = "transparent";
      this._sendAllBtn!.style.color = "rgba(255,255,255,0.65)";
      _saSvg.style.animation = "";
      this._hideApTip();
    }.bind(this));

    this._sendAllBtn.addEventListener("click", function (this: PromptMode) {
      if (this._changeQueue.length > 0) {
        var _cnt = this._changeQueue.length;
        for (var qi = 0; qi < this._changeQueue.length; qi++) {
          this.submitPrompt(this._changeQueue[qi].prompt);
        }
        this._changeQueue.length = 0;
        this._updateQueueBadge();
        if (this._core) this._core._showToast("Queued changes", _cnt);
      }
    }.bind(this));

    this._actionPill.appendChild(this._sendAllBtn);

    this._clearAllBtn = document.createElement("div");
    this._clearAllBtn.style.cssText = "width:32px;height:32px;border-radius:50%;background:transparent;border:none;display:none;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.65);transition:background 120ms ease;flex-shrink:0;padding:0";

    var _caSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    _caSvg.setAttribute("width", "22");
    _caSvg.setAttribute("height", "22");
    _caSvg.setAttribute("viewBox", "0 0 24 24");
    _caSvg.setAttribute("fill", "none");
    _caSvg.setAttribute("stroke", "currentColor");
    _caSvg.setAttribute("stroke-width", "2");
    _caSvg.setAttribute("stroke-linecap", "round");
    _caSvg.setAttribute("stroke-linejoin", "round");

    var _cap = document.createElementNS("http://www.w3.org/2000/svg", "path");
    _cap.setAttribute("d", "M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21");
    _caSvg.appendChild(_cap);

    var _cal = document.createElementNS("http://www.w3.org/2000/svg", "line");
    _cal.setAttribute("x1", "5.082");
    _cal.setAttribute("y1", "11.09");
    _cal.setAttribute("x2", "13.91");
    _cal.setAttribute("y2", "19.918");
    _caSvg.appendChild(_cal);
    this._clearAllBtn.appendChild(_caSvg);

    this._clearAllBtn.addEventListener("mouseenter", function (this: PromptMode) {
      this._clearAllBtn!.style.background = (this._selColor || "#3b82f6") + "33";
      this._clearAllBtn!.style.color = this._selColor || "#3b82f6";
      _caSvg.style.animation = "endow-icon-hover-shake 0.4s cubic-bezier(0.23,1,0.32,1)";
      this._showApTip("Clear All", this._clearAllBtn!);
    }.bind(this));

    this._clearAllBtn.addEventListener("mouseleave", function (this: PromptMode) {
      this._clearAllBtn!.style.background = "transparent";
      this._clearAllBtn!.style.color = "rgba(255,255,255,0.65)";
      _caSvg.style.animation = "";
      this._hideApTip();
    }.bind(this));

    this._clearAllBtn.addEventListener("click", function (this: PromptMode) {
      if (this._changeQueue.length > 0) {
        this._changeQueue.length = 0;
        this._updateQueueBadge();
      }
    }.bind(this));

    this._actionPill.appendChild(this._clearAllBtn);

    this._apTip = document.createElement("div");
    this._apTip.style.cssText = "position:fixed;transform:translateX(-50%) translateY(4px);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:5px 14px;font-size:11px;font-family:system-ui,sans-serif;font-weight:500;color:rgba(255,255,255,0.85);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 120ms ease,transform 120ms ease;box-shadow:0 2px 8px rgba(0,0,0,0.3);z-index:2147483647";

    this.overlay.getContainer().appendChild(this._actionPill);
    this.overlay.getContainer().appendChild(this._apTip);

    this.onKeyDown = function (this: PromptMode, e: KeyboardEvent) {
      (e.metaKey || e.ctrlKey) && e.key === "c" && this.copyContext();
    }.bind(this);
    document.addEventListener("keydown", this.onKeyDown, true);
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    (window as any).__endow_disablePointerBlock();
    this.overlay.hideHighlight();
    this._hLabel && (this._hLabel.remove(), this._hLabel = null);
    this._lasso && (this._lasso.disable(), this._lasso = null);
    this._selRaf && (cancelAnimationFrame(this._selRaf), this._selRaf = null);
    this._selTracked = [];
    this._selOverlays && (this._selOverlays.forEach(function (o: HTMLElement) {
      o.remove();
    }), this._selOverlays = []);
    this.prompt?.destroy();
    this.prompt = null;
    this.multiSelect.clear();
    document.removeEventListener("mousedown", this.boundMousedown, { capture: true });
    document.removeEventListener("mousemove", this.boundMousemove, { capture: true });
    document.removeEventListener("mouseup", this.boundMouseup, { capture: true });
    document.removeEventListener("click", this.boundClick, { capture: true });
    document.removeEventListener("mousemove", this.boundHover);
    this._boundScroll && (window.removeEventListener("scroll", this._boundScroll, true), this._boundScroll = null);
    this._boundResize && (window.removeEventListener("resize", this._boundResize), this._boundResize = null);
    this._queuePanel && (this._queuePanel.remove(), this._queuePanel = null);
    this.onKeyDown && (document.removeEventListener("keydown", this.onKeyDown, true), this.onKeyDown = null);
    this.isDragging = false;
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
    if (isEndowElement(e.target as Node)) return;
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
    var t = (window as any).__endow_elementFromPoint(e.clientX, e.clientY);
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
    if (isEndowElement(e.target as Node)) {
      this.overlay.hideHighlight();
      if (this._hLabel) this._hLabel.style.opacity = "0";
      return;
    }
    var t = (window as any).__endow_elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!t || t === document.documentElement || t === document.body || t.closest && t.closest("[data-endow]") || this.multiSelect.getAll().some(function (s: SelectedElement) {
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

        var _svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        _svg.setAttribute("width", "14");
        _svg.setAttribute("height", "14");
        _svg.setAttribute("viewBox", "0 0 24 24");
        _svg.setAttribute("fill", "none");
        _svg.setAttribute("stroke", "currentColor");
        _svg.setAttribute("stroke-width", "2");
        _svg.setAttribute("stroke-linecap", "round");
        _svg.setAttribute("stroke-linejoin", "round");

        var _d = getElementIcon(_tag, _role, _disp);
        var _p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        _p.setAttribute("d", _d);
        _svg.appendChild(_p);
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

  buildSelectedElement(e: Element): SelectedElement {
    let t = (window as any).__endow_generateSelector(e),
      n = (window as any).__endow_getComputedStylesFiltered(e),
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
      let s = (window as any).__endow_getNearbyText(r.domNode),
        a = (window as any).__endow_getAccessibility(r.domNode),
        l = buildElementInfo(r.domNode, r.selector, r.adapterData, r.computedStyles, s, a);
      return formatElementInfo(l);
    }).join("\n\n---\n\n");
    this.notifyPromptSent(e, t.length);
    this._core && this._core._showToast(e, t.length);
    this.transport.request("push_prompt", {
      context: o,
      prompt: e,
      elementCount: t.length
    }).catch(() => {});
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
      let s = (window as any).__endow_getNearbyText(r.domNode),
        a = (window as any).__endow_getAccessibility(r.domNode),
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
    var c = this._selColor || "#3b82f6";
    var all = this.multiSelect.getAll();
    var self = this;
    for (var i = 0; i < all.length; i++) {
      (function (idx: number) {
        var s = all[idx],
          el = s.domNode as HTMLElement,
          r = el.getBoundingClientRect();
        var o = document.createElement("div") as HTMLDivElement;
        o.style.cssText = "position:fixed;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;background:" + c + "26;border:2px solid " + c + "66;border-radius:5px;pointer-events:none;z-index:2147483643";
        self.overlay.getContainer().appendChild(o);
        self._selOverlays.push(o);

        var lb = document.createElement("div") as HTMLDivElement;
        lb.style.cssText = self._showLabels !== false ? "position:fixed;left:" + (r.right + 4) + "px;top:" + r.top + "px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.85);font-size:11px;font-family:system-ui,sans-serif;font-weight:500;padding:4px 8px 4px 12px;border-radius:20px;pointer-events:all;z-index:2147483644;display:flex;align-items:center;gap:5px;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;cursor:default" : "position:fixed;left:" + (r.right + 4) + "px;top:" + r.top + "px;width:24px;height:24px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:50%;pointer-events:all;z-index:2147483644;display:flex;align-items:center;justify-content:center;cursor:default;box-shadow:0 2px 6px rgba(0,0,0,0.3)";

        if (self._showLabels !== false) {
          var tag = el.tagName.toLowerCase(),
            role = el.getAttribute ? el.getAttribute("role") || "" : "",
            cs2 = getComputedStyle(el),
            disp = cs2.display || "";

          var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("width", "12");
          svg.setAttribute("height", "12");
          svg.setAttribute("viewBox", "0 0 24 24");
          svg.setAttribute("fill", "none");
          svg.setAttribute("stroke", "currentColor");
          svg.setAttribute("stroke-width", "2");
          svg.setAttribute("stroke-linecap", "round");
          svg.setAttribute("stroke-linejoin", "round");

          var d = getElementIcon(tag, role, disp);
          var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
          p.setAttribute("d", d);
          svg.appendChild(p);
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
        xb.style.cssText = "border:none;background:none;color:#ef4444;cursor:pointer;padding:0;margin:0;display:flex;align-items:center;justify-content:center;font-size:0;line-height:0";

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
        lb.appendChild(xb);

        self.overlay.getContainer().appendChild(lb);
        self._selOverlays.push(lb);
        self._selTracked.push({ el: el, box: o, label: lb });
      })(i);
    }

    if (this._selTracked.length > 0) {
      var _update = function () {
        var _mb = 0,
          _ml = Infinity;
        for (var j = 0; j < self._selTracked.length; j++) {
          var tr = self._selTracked[j],
            rect = tr.el.getBoundingClientRect();
          tr.box.style.left = rect.left + "px";
          tr.box.style.top = rect.top + "px";
          tr.box.style.width = rect.width + "px";
          tr.box.style.height = rect.height + "px";
          var _lbX = rect.right + 4,
            _lbW = tr.label.offsetWidth || tr.label.getBoundingClientRect().width || 100,
            _vpW = window.innerWidth;
          if (_lbX + _lbW > _vpW - 4) _lbX = rect.left - _lbW - 4;
          if (_lbX < 4) _lbX = 4;
          var _lbY = rect.top;
          if (_lbY < 4) _lbY = 4;
          if (_lbY + 24 > window.innerHeight) _lbY = window.innerHeight - 28;
          tr.label.style.left = _lbX + "px";
          tr.label.style.top = _lbY + "px";
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
            _botBot = 0;
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

  _updateQueueBadge() {
    if (this._queueCount) {
      var c = this._changeQueue.length;
      this._queueCount.textContent = String(c);
      if (this._actionPill) {
        if (c > 0) {
          this._actionPill.style.display = "flex";
          this._actionPill.getBoundingClientRect();
          this._actionPill.style.opacity = "1";
          this._actionPill.style.transform = "scale(1)";
          this._actionPill.style.animation = "none";
          this._actionPill.offsetHeight;
          this._actionPill.style.animation = "endow-send-pulse 0.5s cubic-bezier(0.23,1,0.32,1)";
        } else {
          this._actionPill.style.opacity = "0";
          this._actionPill.style.transform = "scale(0)";
        }
      }
      if (this._updateActionButtons) this._updateActionButtons();
    }
    if (this._queuePanel) {
      if (this._changeQueue.length === 0) {
        this._queuePanel.style.transition = "opacity 0.2s ease";
        this._queuePanel.style.opacity = "0";
        var _p = this._queuePanel;
        setTimeout(function () {
          _p.remove();
        }, 200);
        this._queuePanel = null;
      } else {
        this._queuePanel.remove();
        this._queuePanel = null;
        this._toggleQueuePanel();
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

  _toggleQueuePanel() {
    if (this._queuePanel) {
      this._queuePanel.remove();
      this._queuePanel = null;
      this._queueBtn!.style.background = "transparent";
      this._queueBtn!.style.color = "rgba(255,255,255,0.65)";
      delete this._queueBtn!.dataset.active;
      return;
    }
    var p = document.createElement("div");
    p.style.cssText = "position:fixed;bottom:72px;left:20px;width:340px;max-height:400px;overflow-y:auto;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.5);padding:12px;display:flex;flex-direction:column;gap:8px;z-index:2147483647;pointer-events:all;font-family:system-ui,sans-serif";

    var hdr = document.createElement("div");
    hdr.style.cssText = "font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);padding:4px 4px 8px;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:4px;display:flex;align-items:center;justify-content:space-between";

    var hdrText = document.createElement("span");
    hdrText.textContent = "Queued Changes (" + this._changeQueue.length + ")";
    hdr.appendChild(hdrText);

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

    for (var i = 0; i < this._changeQueue.length; i++) {
      (function (this: PromptMode, idx: number) {
        var item = this._changeQueue[idx];
        var row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:flex-start;gap:8px;padding:8px;border-radius:10px;background:rgba(255,255,255,0.03)";

        var txt = document.createElement("div");
        txt.style.cssText = "flex:1;min-width:0";

        var pr = document.createElement("div");
        pr.style.cssText = "font-size:12px;color:rgba(255,255,255,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
        pr.textContent = item.prompt;
        txt.appendChild(pr);

        var els = document.createElement("div");
        els.style.cssText = "font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px";
        els.textContent = item.elements.length + " element" + (item.elements.length === 1 ? "" : "s");
        txt.appendChild(els);

        row.appendChild(txt);

        var editBtn = document.createElement("button");
        editBtn.style.cssText = "border:none;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:system-ui,sans-serif;white-space:nowrap";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", function (this: PromptMode) {
          this._editQueueItem(idx);
        }.bind(this));
        row.appendChild(editBtn);

        var rmBtn = document.createElement("button");
        rmBtn.style.cssText = "border:none;background:rgba(239,68,68,0.15);color:#ef4444;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:system-ui,sans-serif;white-space:nowrap";
        rmBtn.textContent = "Remove";
        rmBtn.addEventListener("click", function (this: PromptMode) {
          this._confirmRemoveItem(idx);
        }.bind(this));
        row.appendChild(rmBtn);

        p.appendChild(row);
      }.bind(this))(i);
    }

    this._queuePanel = p;
    var _mc = this._selColor || "#3b82f6";
    this._queueBtn!.style.background = _mc;
    this._queueBtn!.style.color = ["#f97316", "#eab308", "#22c55e"].indexOf(_mc) !== -1 ? "#1a1a1a" : "#fff";
    this._queueBtn!.dataset.active = "1";
    this.overlay.getContainer().appendChild(p);
  }

  _confirmRemoveItem(idx: number) {
    var item = this._changeQueue[idx];
    var d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2147483648;display:flex;align-items:center;justify-content:center;pointer-events:all";

    var box = document.createElement("div");
    box.style.cssText = "background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;max-width:300px;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5)";

    var msg = document.createElement("div");
    msg.style.cssText = "font-size:13px;color:rgba(255,255,255,0.85);margin-bottom:16px";
    msg.textContent = 'Remove "' + item.prompt.slice(0, 40) + (item.prompt.length > 40 ? "..." : "") + '"?';
    box.appendChild(msg);

    var btns = document.createElement("div");
    btns.style.cssText = "display:flex;gap:8px;justify-content:flex-end";

    var cancel = document.createElement("button");
    cancel.style.cssText = "border:1px solid rgba(255,255,255,0.15);background:none;color:rgba(255,255,255,0.65);border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:system-ui,sans-serif";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", function () {
      d.remove();
    });
    btns.appendChild(cancel);

    var confirmBtn = document.createElement("button");
    confirmBtn.style.cssText = "border:none;background:#ef4444;color:#fff;border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:system-ui,sans-serif;font-weight:600";
    confirmBtn.textContent = "Remove";
    confirmBtn.addEventListener("click", function (this: PromptMode) {
      d.remove();
      this._changeQueue.splice(idx, 1);
      this._updateQueueBadge();
      if (this._queuePanel) {
        if (this._changeQueue.length === 0) {
          this._queuePanel.style.transition = "opacity 0.2s ease";
          this._queuePanel.style.opacity = "0";
          var _p = this._queuePanel;
          setTimeout(function () {
            _p.remove();
          }, 200);
          this._queuePanel = null;
        } else {
          this._queuePanel.remove();
          this._queuePanel = null;
          this._toggleQueuePanel();
        }
      }
    }.bind(this));
    btns.appendChild(confirmBtn);
    box.appendChild(btns);
    d.appendChild(box);
    this.overlay.getContainer().appendChild(d);
  }

  _editQueueItem(idx: number) {
    var item = this._changeQueue[idx];
    if (this._queuePanel) {
      this._queuePanel.remove();
      this._queuePanel = null;
    }
    this.multiSelect.clear();
    this._showSelOverlays();
    for (var i = 0; i < item.elements.length; i++) {
      var el = item.elements[i].domNode;
      if (el && document.contains(el)) {
        this.multiSelect.add(this.buildSelectedElement(el));
      }
    }
    this._showSelOverlays();
    this._editingIdx = idx;
    var last = item.elements[0] ? item.elements[0].domNode : null;
    if (last) {
      var rect = last.getBoundingClientRect();
      this.prompt!.show(rect.left + rect.width / 2 - 150, rect.bottom + 12);
    }
    setTimeout(function (this: PromptMode) {
      this.prompt!.input.value = item.prompt;
      this.prompt!.input.dispatchEvent(new Event("input"));
    }.bind(this), 50);
    this.prompt!.enterEditMode(idx, this);
  }

  _updateActionButtons() {
    var has = this._changeQueue.length > 0;
    if (this._sendAllBtn) {
      if (has) {
        this._sendAllBtn.style.display = "flex";
        if (this._pillDivider) this._pillDivider.style.display = "block";
      } else {
        this._sendAllBtn.style.display = "none";
        if (this._pillDivider) this._pillDivider.style.display = "none";
      }
    }
    if (this._clearAllBtn) {
      if (has) {
        this._clearAllBtn.style.display = "flex";
      } else {
        this._clearAllBtn.style.display = "none";
      }
    }
  }

  setColorGetter(fn: () => string) {
    this._getColor = fn;
  }
}
