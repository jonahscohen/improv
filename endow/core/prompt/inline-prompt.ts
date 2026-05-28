export class InlinePrompt {
  container: HTMLDivElement;
  input: HTMLInputElement;
  sendBtn: any;
  checkPath: any;
  submitCallback: ((text: string) => void) | null = null;
  queueCallback?: (text: string) => void;
  afterQueueCallback?: () => void;
  visible: boolean = false;
  queueBtn!: HTMLButtonElement;
  sendNowBtn!: HTMLButtonElement;
  _btnTip!: HTMLDivElement;
  _btnWrap!: HTMLDivElement;
  _btnActive?: boolean;
  _markerColor?: string;
  _qV!: SVGPathElement;
  _qH!: SVGPathElement;
  _editMode?: boolean;
  _editIdx?: number;
  _editPM?: any;
  _editWrap?: HTMLDivElement;
  _editCheckPath?: SVGPathElement;
  _showHints?: boolean;
  _sendBlocked: boolean = false;

  constructor(shadowRoot: ShadowRoot | HTMLElement) {
    this.container = document.createElement("div");
    this.container.style.cssText = "position:fixed;display:none;z-index:2147483647;pointer-events:auto;align-items:center;gap:8px;flex-direction:row";

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.placeholder = "Describe the change...";
    this.input.style.cssText = "width:300px;min-width:300px;background:#1a1a1a;color:#e2e8f0;border:1px solid rgba(255,255,255,0.15);border-radius:20px;padding:10px 18px;transition:box-shadow 300ms ease,border-color 300ms ease;font-size:13px;font-family:EndowSans,system-ui,sans-serif;outline:none;box-shadow:0 4px 16px rgba(0,0,0,0.4);animation:endow-input-glow 3s ease-in-out infinite";

    this.input.addEventListener("focus", () => {
      this.input.style.borderColor = "#D97757";
    });

    this.input.addEventListener("blur", () => {
      this.input.style.borderColor = "rgba(255,255,255,0.15)";
    });

    this.input.addEventListener("keydown", (t) => {
      if (t.stopPropagation(), t.key === "Enter" && (t.metaKey || t.ctrlKey)) this._submit();
      else if (t.key === "Enter") this._queue();
      else if (t.key === "Escape") this.hide();
    });

    this.input.addEventListener("input", () => {
      var hasText = this.input.value.trim().length > 0;
      if (hasText && !this._btnActive) {
        this._btnActive = true;
        var c = "#D97757";
        this.queueBtn.style.transform = "scale(1)";
        this.queueBtn.style.opacity = "1";
        if (!this._sendBlocked) {
          setTimeout(function (this: InlinePrompt) {
            if (this._sendBlocked) return;
            this.sendNowBtn.style.animation = "none";
            this.sendNowBtn.offsetHeight;
            this.sendNowBtn.style.transform = "scale(1)";
            this.sendNowBtn.style.opacity = "1";
            this.sendNowBtn.style.animation = "endow-send-pulse 0.6s ease";
          }.bind(this), 200);
        }
        var _cic = ["#f97316", "#eab308", "#22c55e"].indexOf(c) !== -1 ? "#1a1a1a" : "#fff";
        this.queueBtn.style.background = c;
        this.queueBtn.style.borderColor = c;
        this.queueBtn.style.color = _cic;
        this.sendNowBtn.style.background = c;
        this.sendNowBtn.style.borderColor = c;
        this.sendNowBtn.style.color = _cic;
        this.queueBtn.style.animation = "none";
        this.queueBtn.offsetHeight;
        this.queueBtn.style.animation = "endow-send-pulse 0.6s ease";
        this.sendNowBtn.style.animation = "endow-send-pulse 0.6s ease 0.1s";
      } else if (!hasText && this._btnActive) {
        this._btnActive = false;
        this.queueBtn.style.transform = "scale(0)";
        this.queueBtn.style.opacity = "0";
        this.sendNowBtn.style.transform = "scale(0)";
        this.sendNowBtn.style.opacity = "0";
        this.queueBtn.style.background = "#1a1a1a";
        this.queueBtn.style.borderColor = "rgba(255,255,255,0.15)";
        this.queueBtn.style.color = "rgba(255,255,255,0.65)";
        this.queueBtn.style.animation = "none";
        this.sendNowBtn.style.animation = "none";
        this.sendNowBtn.style.background = "#1a1a1a";
        this.sendNowBtn.style.borderColor = "rgba(255,255,255,0.15)";
        this.sendNowBtn.style.color = "rgba(255,255,255,0.65)";
        this.sendNowBtn.querySelector("svg")!.style.animation = "";
      }
    });

    this.container.appendChild(this.input);

    this._btnTip = document.createElement("div");
    this._btnTip.style.cssText = "position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%) translateY(4px);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:4px 12px;font-size:11px;font-family:EndowSans,system-ui,sans-serif;font-weight:500;color:rgba(255,255,255,0.85);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 120ms ease,transform 120ms ease;box-shadow:0 2px 8px rgba(0,0,0,0.3);z-index:2147483648";

    this._btnWrap = document.createElement("div");
    this._btnWrap.style.cssText = "display:flex;gap:6px;align-items:center";

    this.queueBtn = document.createElement("button");
    this.queueBtn.style.cssText = "width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:#1a1a1a;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.65);transition:background 300ms ease,border-color 300ms ease,color 120ms ease,transform 250ms cubic-bezier(0.23,1,0.32,1),opacity 200ms ease;box-shadow:0 4px 16px rgba(0,0,0,0.4);flex-shrink:0;padding:0;opacity:0;transform:scale(0)";

    this.queueBtn.addEventListener("mouseenter", function (this: InlinePrompt) {
      this._btnActive && (this.queueBtn.style.transform = "scale(1.125)");
      this._showBtnTip("Queue Change", this.queueBtn);
      this._animateQueue();
    }.bind(this));

    this.queueBtn.addEventListener("mouseleave", function (this: InlinePrompt) {
      this._btnActive && (this.queueBtn.style.transform = "scale(1)");
      this._hideBtnTip();
      this._resetQueue();
    }.bind(this));

    this.queueBtn.addEventListener("mousedown", function (this: InlinePrompt) {
      this._btnActive && (this.queueBtn.style.transform = "scale(0.92)");
    }.bind(this));

    this.queueBtn.addEventListener("mouseup", function (this: InlinePrompt) {
      this._btnActive && (this.queueBtn.style.transform = "scale(1)");
    }.bind(this));

    this.queueBtn.addEventListener("click", function (this: InlinePrompt) {
      this._queue();
    }.bind(this));

    var _qs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    _qs.setAttribute("width", "20");
    _qs.setAttribute("height", "20");
    _qs.setAttribute("viewBox", "0 0 24 24");
    _qs.setAttribute("fill", "none");
    _qs.setAttribute("stroke", "currentColor");
    _qs.setAttribute("stroke-width", "2");
    _qs.setAttribute("stroke-linecap", "round");
    _qs.setAttribute("stroke-linejoin", "round");

    this._qV = document.createElementNS("http://www.w3.org/2000/svg", "path");
    this._qV.setAttribute("d", "M12 5v14");
    this._qV.style.cssText = "stroke-dasharray:20;stroke-dashoffset:0;transition:stroke-dashoffset 0.2s ease 0.15s";
    _qs.appendChild(this._qV);

    this._qH = document.createElementNS("http://www.w3.org/2000/svg", "path");
    this._qH.setAttribute("d", "M5 12h14");
    this._qH.style.cssText = "stroke-dasharray:20;stroke-dashoffset:0;transition:stroke-dashoffset 0.2s ease 0.3s";
    _qs.appendChild(this._qH);

    this.queueBtn.appendChild(_qs);
    this._btnWrap.appendChild(this.queueBtn);

    this.sendNowBtn = document.createElement("button");
    this.sendNowBtn.style.cssText = "width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:#1a1a1a;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.65);transition:background 300ms ease,border-color 300ms ease,color 120ms ease,transform 250ms cubic-bezier(0.23,1,0.32,1),opacity 200ms ease;box-shadow:0 4px 16px rgba(0,0,0,0.4);flex-shrink:0;padding:0;opacity:0;transform:scale(0)";

    this.sendNowBtn.addEventListener("mouseenter", function (this: InlinePrompt) {
      this._btnActive && (this.sendNowBtn.style.transform = "scale(1.125)");
      this._showBtnTip("Send to Claude", this.sendNowBtn);
      this.sendNowBtn.querySelector("svg")!.style.animation = "endow-icon-hover-nudge 0.7s cubic-bezier(0.23,1,0.32,1)";
    }.bind(this));

    this.sendNowBtn.addEventListener("mouseleave", function (this: InlinePrompt) {
      this._btnActive && (this.sendNowBtn.style.transform = "scale(1)");
      this._hideBtnTip();
      this.sendNowBtn.querySelector("svg")!.style.animation = "";
    }.bind(this));

    this.sendNowBtn.addEventListener("mousedown", function (this: InlinePrompt) {
      this._btnActive && (this.sendNowBtn.style.transform = "scale(0.92)");
    }.bind(this));

    this.sendNowBtn.addEventListener("mouseup", function (this: InlinePrompt) {
      this._btnActive && (this.sendNowBtn.style.transform = "scale(1)");
    }.bind(this));

    this.sendNowBtn.addEventListener("click", function (this: InlinePrompt) {
      this._submit();
    }.bind(this));

    var _ss = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    _ss.setAttribute("width", "18");
    _ss.setAttribute("height", "18");
    _ss.setAttribute("viewBox", "0 0 24 24");
    _ss.setAttribute("fill", "none");
    _ss.setAttribute("stroke", "currentColor");
    _ss.setAttribute("stroke-width", "2");
    _ss.setAttribute("stroke-linecap", "round");
    _ss.setAttribute("stroke-linejoin", "round");

    var _sp1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    _sp1.setAttribute("d", "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z");
    _ss.appendChild(_sp1);

    var _sp2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    _sp2.setAttribute("x1", "21.854");
    _sp2.setAttribute("y1", "2.147");
    _sp2.setAttribute("x2", "10.914");
    _sp2.setAttribute("y2", "13.086");
    _ss.appendChild(_sp2);

    this.sendNowBtn.appendChild(_ss);
    this._btnWrap.appendChild(this.sendNowBtn);
    this._btnWrap.style.cssText += "position:relative";
    this._btnWrap.appendChild(this._btnTip);
    this.container.appendChild(this._btnWrap);

    shadowRoot.appendChild(this.container);
  }

  _showBtnTip(text: string, btn: HTMLElement) {
    if (!this._btnTip || this._showHints === false) return;
    if (this._btnTip) {
      this._btnTip.textContent = text;
      var wr = this._btnWrap.getBoundingClientRect(),
        br = btn.getBoundingClientRect();
      var _btX = br.left - wr.left + br.width / 2,
        _btW = this._btnTip.offsetWidth || 80;
      if (br.left + br.width / 2 + _btW / 2 > window.innerWidth) _btX = window.innerWidth - wr.left - _btW / 2 - 8;
      this._btnTip.style.left = _btX + "px";
      this._btnTip.style.opacity = "1";
      this._btnTip.style.transform = "translateX(-50%) translateY(0)";
    }
  }

  _hideBtnTip() {
    if (this._btnTip) {
      this._btnTip.style.opacity = "0";
      this._btnTip.style.transform = "translateX(-50%) translateY(4px)";
    }
  }

  _queue() {
    var n = this.input.value.trim();
    if (!n) return;
    if (this.queueCallback) this.queueCallback(n);
    if (this.afterQueueCallback) this.afterQueueCallback();
    this.hide();
  }

  _submit() {
    if (this._sendBlocked) {
      this._flashBlockedFeedback();
      return;
    }
    var n = this.input.value.trim();
    n && this.submitCallback && this.submitCallback(n);
    this.hide();
  }

  _flashBlockedFeedback() {
    this.input.style.borderColor = '#D97757';
    this.input.style.boxShadow = '0 0 0 2px rgba(217,119,87,0.3)';
    setTimeout(() => {
      this.input.style.borderColor = 'rgba(255,255,255,0.15)';
      this.input.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
    }, 600);
  }

  _animateQueue() {
    if (this._qV) {
      this._qV.style.transition = "none";
      this._qV.style.strokeDashoffset = "20";
      this._qV.getBoundingClientRect();
      this._qV.style.transition = "stroke-dashoffset 0.2s ease 0.15s";
      this._qV.style.strokeDashoffset = "0";
    }
    if (this._qH) {
      this._qH.style.transition = "none";
      this._qH.style.strokeDashoffset = "20";
      this._qH.getBoundingClientRect();
      this._qH.style.transition = "stroke-dashoffset 0.2s ease 0.3s";
      this._qH.style.strokeDashoffset = "0";
    }
  }

  _resetQueue() {
    this._qV && (this._qV.style.strokeDashoffset = "0");
    this._qH && (this._qH.style.strokeDashoffset = "0");
  }

  show(x: number, y: number) {
    this.input.style.setProperty("--endow-glow-color", "#D97757");
    this.container.style.transition = "left 200ms cubic-bezier(0.23,1,0.32,1),top 200ms cubic-bezier(0.23,1,0.32,1)";
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
    this.container.style.display = "flex";
    this.visible = true;
    requestAnimationFrame(() => {
      this.input.value = "";
      this.input.focus();
    });
  }

  hide() {
    this.container.style.display = "none";
    this.visible = false;
    this._btnActive = false;
    this.queueBtn.style.transform = "scale(0)";
    this.queueBtn.style.opacity = "0";
    this.sendNowBtn.style.transform = "scale(0)";
    this.sendNowBtn.style.opacity = "0";
    this.queueBtn.style.background = "#1a1a1a";
    this.queueBtn.style.borderColor = "rgba(255,255,255,0.15)";
    this.queueBtn.style.color = "rgba(255,255,255,0.65)";
    this.queueBtn.style.animation = "none";
    this.sendNowBtn.style.background = "#1a1a1a";
    this.sendNowBtn.style.borderColor = "rgba(255,255,255,0.15)";
    this.sendNowBtn.style.color = "rgba(255,255,255,0.65)";
    this.sendNowBtn.querySelector("svg")!.style.animation = "";
  }

  onPromptSubmit(cb: (text: string) => void) {
    this.submitCallback = cb;
  }

  onPromptQueue(cb: (text: string) => void) {
    this.queueCallback = cb;
  }

  onAfterQueue(cb: () => void) {
    this.afterQueueCallback = cb;
  }

  isVisible(): boolean {
    return this.visible;
  }

  enterEditMode(idx: number, promptMode: any) {
    this._editMode = true;
    this._editIdx = idx;
    this._editPM = promptMode;
    this._btnWrap.style.display = "none";

    if (!this._editWrap) {
      this._editWrap = document.createElement("div");
      this._editWrap.style.cssText = "display:flex;gap:6px;align-items:center";

      var _confirmBtn = document.createElement("button");
      _confirmBtn.style.cssText = "width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:#1a1a1a;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.65);transition:background 120ms ease,color 120ms ease,transform 250ms cubic-bezier(0.23,1,0.32,1);box-shadow:0 4px 16px rgba(0,0,0,0.4);flex-shrink:0;padding:0";

      var _cSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      _cSvg.setAttribute("width", "18");
      _cSvg.setAttribute("height", "18");
      _cSvg.setAttribute("viewBox", "0 0 24 24");
      _cSvg.setAttribute("fill", "none");
      _cSvg.setAttribute("stroke", "currentColor");
      _cSvg.setAttribute("stroke-width", "2");
      _cSvg.setAttribute("stroke-linecap", "round");
      _cSvg.setAttribute("stroke-linejoin", "round");

      this._editCheckPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      this._editCheckPath.setAttribute("d", "M4 12 9 17L20 6");
      this._editCheckPath.style.cssText = "stroke-dasharray:30;stroke-dashoffset:0;transition:stroke-dashoffset 0.4s ease";
      _cSvg.appendChild(this._editCheckPath);
      _confirmBtn.appendChild(_cSvg);

      _confirmBtn.addEventListener("mouseenter", function (this: InlinePrompt) {
        var _mc = "#D97757";
        _confirmBtn.style.background = _mc;
        _confirmBtn.style.color = ["#f97316", "#eab308", "#22c55e"].indexOf(_mc) !== -1 ? "#1a1a1a" : "#fff";
        _confirmBtn.style.transform = "scale(1.125)";
        if (this._editCheckPath) {
          this._editCheckPath.style.transition = "none";
          this._editCheckPath.style.strokeDashoffset = "30";
          this._editCheckPath.getBoundingClientRect();
          this._editCheckPath.style.transition = "stroke-dashoffset 0.4s ease";
          this._editCheckPath.style.strokeDashoffset = "0";
        }
      }.bind(this));

      _confirmBtn.addEventListener("mouseleave", function (this: InlinePrompt) {
        _confirmBtn.style.background = "#1a1a1a";
        _confirmBtn.style.color = "rgba(255,255,255,0.65)";
        _confirmBtn.style.transform = "";
        if (this._editCheckPath) {
          this._editCheckPath.style.strokeDashoffset = "0";
        }
      }.bind(this));

      _confirmBtn.addEventListener("click", function (this: InlinePrompt) {
        var txt = this.input.value.trim();
        if (txt && this._editPM) {
          this._editPM._changeQueue[this._editIdx!].prompt = txt;
          this._editPM._updateQueueBadge();
          if (this._editPM._persistQueue) this._editPM._persistQueue();
        }
        this.exitEditMode();
      }.bind(this));

      this._editWrap.appendChild(_confirmBtn);

      var _delBtn = document.createElement("button");
      _delBtn.style.cssText = "width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:#1a1a1a;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#ef4444;transition:background 120ms ease,color 120ms ease,transform 250ms cubic-bezier(0.23,1,0.32,1);box-shadow:0 4px 16px rgba(0,0,0,0.4);flex-shrink:0;padding:0";

      var _xSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      _xSvg.setAttribute("width", "14");
      _xSvg.setAttribute("height", "14");
      _xSvg.setAttribute("viewBox", "0 0 24 24");
      _xSvg.setAttribute("fill", "none");
      _xSvg.setAttribute("stroke", "currentColor");
      _xSvg.setAttribute("stroke-width", "3");
      _xSvg.setAttribute("stroke-linecap", "round");

      var _xp1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      _xp1.setAttribute("d", "M18 6 6 18");
      _xp1.style.cssText = "stroke-dasharray:20;stroke-dashoffset:0;transition:stroke-dashoffset 0.3s ease";
      _xSvg.appendChild(_xp1);

      var _xp2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      _xp2.setAttribute("d", "m6 6 12 12");
      _xp2.style.cssText = "stroke-dasharray:20;stroke-dashoffset:0;transition:stroke-dashoffset 0.3s ease 0.1s";
      _xSvg.appendChild(_xp2);

      _delBtn.appendChild(_xSvg);

      _delBtn.addEventListener("mouseenter", function () {
        _delBtn.style.background = "#ef4444";
        _delBtn.style.color = "#fff";
        _delBtn.style.transform = "scale(1.125)";
        _xp1.style.transition = "none";
        _xp2.style.transition = "none";
        _xp1.style.strokeDashoffset = "20";
        _xp2.style.strokeDashoffset = "20";
        _xSvg.getBoundingClientRect();
        _xp1.style.transition = "stroke-dashoffset 0.3s ease";
        _xp2.style.transition = "stroke-dashoffset 0.3s ease 0.1s";
        _xp1.style.strokeDashoffset = "0";
        _xp2.style.strokeDashoffset = "0";
      });

      _delBtn.addEventListener("mouseleave", function () {
        _delBtn.style.background = "#1a1a1a";
        _delBtn.style.color = "#ef4444";
        _delBtn.style.transform = "";
      });

      _delBtn.addEventListener("click", function (this: InlinePrompt) {
        if (this._editPM) {
          this._editPM._changeQueue.splice(this._editIdx, 1);
          this._editPM._updateQueueBadge();
          if (this._editPM._persistQueue) this._editPM._persistQueue();
        }
        this.exitEditMode();
      }.bind(this));

      this._editWrap.appendChild(_delBtn);
    }

    this.container.appendChild(this._editWrap);
    this._editWrap.style.display = "flex";
  }

  exitEditMode() {
    this._editMode = false;
    this._editIdx = -1;
    if (this._editPM && this._editPM._clearEditHighlights) this._editPM._clearEditHighlights();
    this._editPM = null;
    if (this._editWrap) this._editWrap.style.display = "none";
    this._btnWrap.style.display = "flex";
    this.hide();
  }

  setMarkerColor(c: string) {
    this._markerColor = c;
    var _ic = ["#f97316", "#eab308", "#22c55e"].indexOf(c) !== -1 ? "#1a1a1a" : "#fff";
    if (this.input) this.input.style.setProperty("--endow-glow-color", c);
    if (this._btnActive) {
      this.queueBtn.style.background = c;
      this.queueBtn.style.borderColor = c;
      this.queueBtn.style.color = _ic;
      this.sendNowBtn.style.background = c;
      this.sendNowBtn.style.borderColor = c;
      this.sendNowBtn.style.color = _ic;
    }
  }

  setSendBlocked(blocked: boolean) {
    this._sendBlocked = blocked;
    if (blocked) {
      this.sendNowBtn.style.transform = "scale(0)";
      this.sendNowBtn.style.opacity = "0";
    } else if (this._btnActive) {
      this.sendNowBtn.style.transition = "transform 200ms cubic-bezier(0.23,1,0.32,1), opacity 200ms ease";
      this.sendNowBtn.style.transform = "scale(1)";
      this.sendNowBtn.style.opacity = "1";
    }
  }

  destroy() {
    this.container.remove();
  }
}
