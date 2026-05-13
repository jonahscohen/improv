interface ChangeEntry {
  promptId: string;
  summary: string;
  filesChanged: string[];
  changes: Array<{ selector: string; property: string; oldValue: string; newValue: string }>;
  status: 'completed' | 'needsInfo' | 'failed';
  question?: string;
  reviewed: boolean;
}

type ReplyCallback = (promptId: string, text: string) => void;

export class ChangesPanel {
  private container: HTMLDivElement;
  private listEl: HTMLDivElement;
  private shadowRoot: ShadowRoot;
  private visible = false;
  private focusedIndex = -1;
  private entries: ChangeEntry[] = [];
  private onReplyCallback: ReplyCallback | null = null;
  private onDoneCallback: ((promptId: string) => void) | null = null;
  private onRevertCallback: ((promptId: string, changes: any[]) => void) | null = null;
  private getMarkerColor: () => string;
  private boundKeydown: (e: KeyboardEvent) => void;

  constructor(shadowRoot: ShadowRoot, getMarkerColor: () => string) {
    this.shadowRoot = shadowRoot;
    this.getMarkerColor = getMarkerColor;

    this.container = document.createElement('div');
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-label', 'Changes from Claude');
    this.container.style.cssText =
      'position:fixed;bottom:68px;left:20px;width:360px;max-height:480px;' +
      'background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.5);display:none;flex-direction:column;' +
      'z-index:2147483647;pointer-events:all;font-family:system-ui,-apple-system,sans-serif;' +
      'overflow:hidden;opacity:0;transform:translateY(8px);' +
      'transition:opacity 200ms ease,transform 200ms ease';

    const header = document.createElement('div');
    header.style.cssText =
      'padding:14px 16px 10px;border-bottom:1px solid rgba(255,255,255,0.1);' +
      'display:flex;align-items:center;justify-content:space-between;flex-shrink:0';

    const title = document.createElement('span');
    title.id = 'improv-changes-title';
    title.textContent = 'Changes';
    title.style.cssText = 'font-size:13px;font-weight:600;color:rgba(255,255,255,0.85)';
    header.appendChild(title);
    this.container.setAttribute('aria-labelledby', 'improv-changes-title');

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Close changes panel');
    closeBtn.style.cssText =
      'width:24px;height:24px;border:none;background:transparent;border-radius:6px;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;' +
      'color:rgba(255,255,255,0.5);transition:background 120ms ease;outline:none';
    const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    closeSvg.setAttribute('width', '14');
    closeSvg.setAttribute('height', '14');
    closeSvg.setAttribute('viewBox', '0 0 24 24');
    closeSvg.setAttribute('fill', 'none');
    closeSvg.setAttribute('stroke', 'currentColor');
    closeSvg.setAttribute('stroke-width', '2.5');
    closeSvg.setAttribute('stroke-linecap', 'round');
    const cp1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cp1.setAttribute('d', 'M18 6 6 18');
    closeSvg.appendChild(cp1);
    const cp2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cp2.setAttribute('d', 'm6 6 12 12');
    closeSvg.appendChild(cp2);
    closeBtn.appendChild(closeSvg);
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(255,255,255,0.08)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'transparent'; });
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);
    this.container.appendChild(header);

    this.listEl = document.createElement('div');
    this.listEl.setAttribute('role', 'list');
    this.listEl.style.cssText = 'overflow-y:auto;flex:1;padding:8px';
    this.container.appendChild(this.listEl);

    this.boundKeydown = this.handleKeydown.bind(this);
    shadowRoot.appendChild(this.container);
  }

  private handleKeydown(e: KeyboardEvent) {
    if (!this.visible) return;
    const active = this.shadowRoot.activeElement ?? document.activeElement;
    const tag = (active as HTMLElement)?.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || (active as HTMLElement)?.isContentEditable;
    if (inInput && e.key !== 'Escape') return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
    } else if (e.key === 'j' || e.key === 'J') {
      e.preventDefault();
      this.moveFocus(1);
    } else if (e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      this.moveFocus(-1);
    } else if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      if (this.focusedIndex >= 0 && this.focusedIndex < this.entries.length) {
        this.markDone(this.entries[this.focusedIndex].promptId);
      }
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      if (this.focusedIndex >= 0 && this.focusedIndex < this.entries.length) {
        this.startReply(this.focusedIndex);
      }
    }
  }

  private moveFocus(dir: number) {
    if (this.entries.length === 0) return;
    this.focusedIndex = Math.max(0, Math.min(this.entries.length - 1, this.focusedIndex + dir));
    this.render();
    const items = this.listEl.querySelectorAll('[role="listitem"]');
    if (items[this.focusedIndex]) {
      (items[this.focusedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }

  show(entries: ChangeEntry[]) {
    this.entries = entries;
    this.visible = true;
    this.container.style.display = 'flex';
    this.container.getBoundingClientRect();
    this.container.style.opacity = '1';
    this.container.style.transform = 'translateY(0)';
    this.render();
    document.addEventListener('keydown', this.boundKeydown, true);
    this.listEl.scrollTop = this.listEl.scrollHeight;
  }

  hide() {
    this.visible = false;
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateY(8px)';
    setTimeout(() => { if (!this.visible) this.container.style.display = 'none'; }, 200);
    this.focusedIndex = -1;
    document.removeEventListener('keydown', this.boundKeydown, true);
  }

  toggle(entries: ChangeEntry[]) {
    if (this.visible) this.hide();
    else this.show(entries);
  }

  isVisible() { return this.visible; }

  setOnReply(cb: ReplyCallback) { this.onReplyCallback = cb; }
  setOnDone(cb: (promptId: string) => void) { this.onDoneCallback = cb; }
  setOnRevert(cb: (promptId: string, changes: any[]) => void) { this.onRevertCallback = cb; }

  private markDone(promptId: string) {
    const entry = this.entries.find(e => e.promptId === promptId);
    if (entry) {
      entry.reviewed = true;
      if (this.onDoneCallback) this.onDoneCallback(promptId);
      this.render();
    }
  }

  private startReply(index: number) {
    const entry = this.entries[index];
    if (!entry) return;
    const items = this.listEl.querySelectorAll('[role="listitem"]');
    const item = items[index] as HTMLElement;
    if (!item) return;

    let replyWrap = item.querySelector('.improv-reply-wrap') as HTMLDivElement;
    if (replyWrap) { replyWrap.querySelector('input')?.focus(); return; }

    replyWrap = document.createElement('div');
    replyWrap.className = 'improv-reply-wrap';
    replyWrap.style.cssText = 'display:flex;gap:6px;margin-top:8px';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Reply to this change...';
    input.setAttribute('aria-label', 'Reply to change');
    input.style.cssText =
      'flex:1;background:#252525;border:1px solid rgba(255,255,255,0.12);border-radius:8px;' +
      'padding:6px 10px;font-size:12px;color:rgba(255,255,255,0.85);outline:none;' +
      'font-family:system-ui,sans-serif';
    const mc = this.getMarkerColor;
    input.addEventListener('focus', () => { input.style.borderColor = mc(); });
    input.addEventListener('blur', () => { input.style.borderColor = 'rgba(255,255,255,0.12)'; });
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter' && input.value.trim()) {
        if (this.onReplyCallback) this.onReplyCallback(entry.promptId, input.value.trim());
        replyWrap.remove();
      } else if (e.key === 'Escape') {
        replyWrap.remove();
      }
    });

    replyWrap.appendChild(input);
    item.appendChild(replyWrap);
    input.focus();
  }

  private render() {
    while (this.listEl.firstChild) this.listEl.removeChild(this.listEl.firstChild);
    const mc = this.getMarkerColor();

    if (this.entries.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:24px 16px;text-align:center;color:rgba(255,255,255,0.35);font-size:12px';
      empty.textContent = 'No changes yet';
      this.listEl.appendChild(empty);
      return;
    }

    this.entries.forEach((entry, i) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.style.cssText =
        'padding:10px 12px;border-radius:10px;margin-bottom:6px;' +
        'background:' + (i === this.focusedIndex ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)') + ';' +
        'transition:background 80ms ease;' +
        'opacity:' + (entry.reviewed ? '0.4' : '1');

      const topRow = document.createElement('div');
      topRow.style.cssText = 'display:flex;align-items:flex-start;gap:8px';

      const dot = document.createElement('div');
      dot.style.cssText =
        'width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:4px;background:' +
        (entry.status === 'completed' ? '#22c55e' : entry.status === 'needsInfo' ? mc : '#ef4444');
      dot.setAttribute('aria-label', entry.status);
      topRow.appendChild(dot);

      const summaryEl = document.createElement('div');
      summaryEl.style.cssText = 'flex:1;min-width:0';

      const summaryText = document.createElement('div');
      summaryText.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.85);line-height:1.4';
      summaryText.textContent = entry.summary;
      summaryEl.appendChild(summaryText);

      if (entry.filesChanged.length > 0) {
        const files = document.createElement('div');
        files.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.35);margin-top:3px';
        files.textContent = entry.filesChanged.join(', ');
        summaryEl.appendChild(files);
      }

      if (entry.changes.length > 0) {
        const changesWrap = document.createElement('div');
        changesWrap.style.cssText = 'margin-top:6px;display:flex;flex-wrap:wrap;gap:4px';
        for (const c of entry.changes.slice(0, 4)) {
          const pill = document.createElement('span');
          pill.style.cssText =
            'font-size:10px;padding:2px 6px;border-radius:4px;' +
            'background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);' +
            'font-family:ui-monospace,monospace;white-space:nowrap';
          pill.textContent = c.property + ': ' + c.oldValue + ' \u2192 ' + c.newValue;
          changesWrap.appendChild(pill);
        }
        if (entry.changes.length > 4) {
          const more = document.createElement('span');
          more.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.3);padding:2px 4px';
          more.textContent = '+' + (entry.changes.length - 4) + ' more';
          changesWrap.appendChild(more);
        }
        summaryEl.appendChild(changesWrap);
      }

      if (entry.status === 'needsInfo' && entry.question) {
        const q = document.createElement('div');
        q.style.cssText =
          'margin-top:6px;padding:6px 10px;border-radius:8px;font-size:11px;' +
          'background:' + mc + '15;color:' + mc + ';border-left:2px solid ' + mc;
        q.textContent = entry.question;
        summaryEl.appendChild(q);
      }

      topRow.appendChild(summaryEl);
      item.appendChild(topRow);

      if (!entry.reviewed) {
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:6px;margin-top:8px;padding-left:16px';

        const doneBtn = this.makeActionBtn('Done', () => this.markDone(entry.promptId));
        doneBtn.setAttribute('aria-label', 'Mark change as reviewed');
        actions.appendChild(doneBtn);

        if (entry.changes && entry.changes.length > 0) {
          const revertBtn = this.makeActionBtn('Revert', () => {
            if (this.onRevertCallback) this.onRevertCallback(entry.promptId, entry.changes);
          });
          revertBtn.setAttribute('aria-label', 'Revert this change preview');
          actions.appendChild(revertBtn);
        }

        const replyBtn = this.makeActionBtn('Reply', () => this.startReply(i));
        replyBtn.setAttribute('aria-label', 'Reply to this change');
        actions.appendChild(replyBtn);

        item.appendChild(actions);
      }

      item.addEventListener('click', () => {
        this.focusedIndex = i;
        this.render();
      });

      this.listEl.appendChild(item);
    });
  }

  private makeActionBtn(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText =
      'border:none;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);' +
      'border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;' +
      'font-family:system-ui,sans-serif;transition:background 120ms ease;outline:none';
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.06)'; });
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  destroy() {
    this.hide();
    this.container.remove();
  }
}
