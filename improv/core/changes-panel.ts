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
  private _detailEl: HTMLDivElement;
  private bottomBar: HTMLDivElement;
  private shadowRoot: ShadowRoot;
  private visible = false;
  private focusedIndex = -1;
  private entries: ChangeEntry[] = [];
  private filteredEntries: ChangeEntry[] = [];
  private onReplyCallback: ReplyCallback | null = null;
  private onDoneCallback: ((promptId: string) => void) | null = null;
  private onRevertCallback: ((promptId: string, changes: any[]) => void) | null = null;
  private onClearReviewedCallback: (() => void) | null = null;
  private onSelectCallback: ((selectors: string[]) => void) | null = null;
  private onItemClickCallback: ((index: number) => void) | null = null;
  private _clearReviewedBtn: HTMLButtonElement | null = null;
  private revertedPrompts = new Set<string>();
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

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;gap:8px';
    const title = document.createElement('span');
    title.id = 'improv-changes-title';
    title.textContent = 'Changes';
    title.style.cssText = 'font-size:13px;font-weight:600;color:rgba(255,255,255,0.85)';
    titleWrap.appendChild(title);
    header.appendChild(titleWrap);
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

    // Detail view container (hidden by default)
    this._detailEl = document.createElement('div');
    this._detailEl.style.cssText =
      'display:none;overflow-y:auto;flex:1;padding:0;' +
      'transition:opacity 150ms ease,transform 150ms ease';
    this.container.appendChild(this._detailEl);

    // Bottom bar for the clear button (below the list)
    this.bottomBar = document.createElement('div');
    this.bottomBar.style.cssText =
      'padding:10px 16px;border-top:1px solid rgba(255,255,255,0.1);flex-shrink:0;display:none';
    this._clearReviewedBtn = document.createElement('button');
    this._clearReviewedBtn.textContent = 'Clear Completed Tasks';
    this._clearReviewedBtn.setAttribute('aria-label', 'Clear all reviewed changes');
    this._clearReviewedBtn.style.cssText =
      'border:none;background:none;color:rgba(255,255,255,0.3);font-size:10px;cursor:pointer;' +
      'padding:0;font-family:system-ui,sans-serif;outline:none';
    this._clearReviewedBtn.addEventListener('mouseenter', () => { this._clearReviewedBtn!.style.color = 'rgba(255,255,255,0.6)'; });
    this._clearReviewedBtn.addEventListener('mouseleave', () => { this._clearReviewedBtn!.style.color = 'rgba(255,255,255,0.3)'; });
    this._clearReviewedBtn.addEventListener('click', () => {
      this.entries = this.entries.filter(e => !e.reviewed);
      if (this.onClearReviewedCallback) this.onClearReviewedCallback();
      this.filterEntries();
      if (this.filteredEntries.length === 0) {
        this.hide();
      } else {
        this.render();
        this._updateClearBtn();
      }
    });
    this.bottomBar.appendChild(this._clearReviewedBtn);
    this.container.appendChild(this.bottomBar);

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
      // If detail view is showing, go back to list first
      if (this._detailEl.style.display !== 'none') {
        this.hideDetail();
      } else {
        this.hide();
      }
    } else if (e.key === 'j' || e.key === 'J') {
      e.preventDefault();
      this.moveFocus(1);
    } else if (e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      this.moveFocus(-1);
    } else if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      if (this.focusedIndex >= 0 && this.focusedIndex < this.filteredEntries.length) {
        this.markDone(this.filteredEntries[this.focusedIndex].promptId);
      }
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      if (this.focusedIndex >= 0 && this.focusedIndex < this.filteredEntries.length) {
        this.startReply(this.focusedIndex);
      }
    }
  }

  private moveFocus(dir: number) {
    if (this.filteredEntries.length === 0) return;
    this.focusedIndex = Math.max(0, Math.min(this.filteredEntries.length - 1, this.focusedIndex + dir));
    this.render();
    const items = this.listEl.querySelectorAll('[role="listitem"]');
    if (items[this.focusedIndex]) {
      (items[this.focusedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }

  /** Filter entries to only actionable ones */
  private filterEntries(): void {
    this.filteredEntries = this.entries.filter(entry => {
      if (entry.status === 'completed' && entry.changes.length > 0) return true;
      if (entry.status === 'needsInfo') return true;
      return false;
    });
  }

  show(entries: ChangeEntry[]) {
    this.entries = entries;
    this.filterEntries();
    if (this.filteredEntries.length === 0) {
      this.hide();
      return;
    }
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
    if (this.onSelectCallback) this.onSelectCallback([]);
    document.removeEventListener('keydown', this.boundKeydown, true);
    // Reset detail view on hide
    this.hideDetail();
  }

  toggle(entries: ChangeEntry[]) {
    if (this.visible) this.hide();
    else this.show(entries);
  }

  isVisible() { return this.visible; }

  setOnReply(cb: ReplyCallback) { this.onReplyCallback = cb; }
  setOnDone(cb: (promptId: string) => void) { this.onDoneCallback = cb; }
  setOnRevert(cb: (promptId: string, changes: any[]) => void) { this.onRevertCallback = cb; }
  setOnClearReviewed(cb: () => void) { this.onClearReviewedCallback = cb; }
  setOnSelect(cb: (selectors: string[]) => void) { this.onSelectCallback = cb; }
  setOnItemClick(cb: (index: number) => void) { this.onItemClickCallback = cb; }

  private markDone(promptId: string) {
    if (this.onDoneCallback) this.onDoneCallback(promptId);
    // Re-sync entries from source and re-render
    this.filterEntries();
    this.render();
  }

  private startReply(index: number) {
    const entry = this.filteredEntries[index];
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
        const replyText = input.value.trim();
        input.disabled = true;
        input.value = 'Sending...';
        input.style.color = 'rgba(255,255,255,0.35)';
        if (this.onReplyCallback) this.onReplyCallback(entry.promptId, replyText);
        setTimeout(() => {
          input.value = 'Sent';
          input.style.color = '#22c55e';
          setTimeout(() => replyWrap.remove(), 800);
        }, 300);
      } else if (e.key === 'Escape') {
        replyWrap.remove();
      }
    });

    replyWrap.appendChild(input);
    item.appendChild(replyWrap);
    input.focus();
  }

  showDetail(entry: ChangeEntry, index: number) {
    // Hide the list
    this.listEl.style.display = 'none';
    this.bottomBar.style.display = 'none';

    // Clear and populate detail container
    while (this._detailEl.firstChild) this._detailEl.removeChild(this._detailEl.firstChild);
    this._detailEl.style.display = 'flex';
    this._detailEl.style.flexDirection = 'column';
    this._detailEl.style.opacity = '0';
    this._detailEl.style.transform = 'translateX(8px)';

    // Back button
    const backBtn = document.createElement('button');
    backBtn.style.cssText =
      'display:flex;align-items:center;gap:6px;border:none;background:none;' +
      'color:rgba(255,255,255,0.6);font-size:12px;cursor:pointer;padding:12px 16px;' +
      'font-family:system-ui,sans-serif;outline:none;flex-shrink:0;' +
      'transition:color 120ms ease';
    backBtn.addEventListener('mouseenter', () => { backBtn.style.color = 'rgba(255,255,255,0.85)'; });
    backBtn.addEventListener('mouseleave', () => { backBtn.style.color = 'rgba(255,255,255,0.6)'; });

    const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrowSvg.setAttribute('width', '14');
    arrowSvg.setAttribute('height', '14');
    arrowSvg.setAttribute('viewBox', '0 0 24 24');
    arrowSvg.setAttribute('fill', 'none');
    arrowSvg.setAttribute('stroke', 'currentColor');
    arrowSvg.setAttribute('stroke-width', '2');
    arrowSvg.setAttribute('stroke-linecap', 'round');
    arrowSvg.setAttribute('stroke-linejoin', 'round');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M19 12H5');
    arrowSvg.appendChild(arrowPath);
    const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowHead.setAttribute('d', 'm12 19-7-7 7-7');
    arrowSvg.appendChild(arrowHead);
    backBtn.appendChild(arrowSvg);

    const backLabel = document.createElement('span');
    backLabel.textContent = 'Back';
    backBtn.appendChild(backLabel);
    backBtn.addEventListener('click', () => this.hideDetail());
    this._detailEl.appendChild(backBtn);

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.1);flex-shrink:0';
    this._detailEl.appendChild(sep);

    // Scrollable content area
    const scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'overflow-y:auto;flex:1;padding:12px 16px';

    // Entry summary header
    const summaryHeader = document.createElement('div');
    summaryHeader.style.cssText = 'margin-bottom:16px';

    const numLabel = document.createElement('span');
    numLabel.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;' +
      'width:20px;height:20px;border-radius:50%;background:#D97757;' +
      'font-size:10px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;' +
      'font-family:system-ui,sans-serif;margin-right:8px;vertical-align:middle';
    numLabel.textContent = String(index + 1);
    summaryHeader.appendChild(numLabel);

    const summarySpan = document.createElement('span');
    summarySpan.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.85);line-height:1.4';
    summarySpan.textContent = entry.summary;
    summaryHeader.appendChild(summarySpan);

    scrollArea.appendChild(summaryHeader);

    // Group changes by file
    const changesByFile = new Map<string, Array<{ selector: string; property: string; oldValue: string; newValue: string }>>();

    // Initialize with all filesChanged so files with no matching changes still get a header
    for (const f of entry.filesChanged) {
      if (!changesByFile.has(f)) changesByFile.set(f, []);
    }

    // Assign changes to files - match by checking if the selector relates to the file
    // Since changes don't have a direct file field, distribute all changes under each file
    // In practice each entry's changes are for the files listed in filesChanged
    for (const c of entry.changes) {
      // Add to all files if we can't determine which file a change belongs to
      if (entry.filesChanged.length === 1) {
        const file = entry.filesChanged[0];
        changesByFile.get(file)!.push(c);
      } else {
        // Distribute to all files when ambiguous - the selector is the disambiguator visually
        for (const f of entry.filesChanged) {
          if (!changesByFile.has(f)) changesByFile.set(f, []);
          changesByFile.get(f)!.push(c);
        }
      }
    }

    // Render each file group
    changesByFile.forEach((changes, filename) => {
      const fileSection = document.createElement('div');
      fileSection.style.cssText = 'margin-bottom:14px';

      const fileHeader = document.createElement('div');
      fileHeader.style.cssText =
        'font-size:11px;color:rgba(255,255,255,0.5);font-family:ui-monospace,monospace;' +
        'padding:4px 0;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06)';
      fileHeader.textContent = filename;
      fileSection.appendChild(fileHeader);

      for (const c of changes) {
        const diffRow = document.createElement('div');
        diffRow.style.cssText =
          'padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)';

        const selectorEl = document.createElement('div');
        selectorEl.style.cssText =
          'font-size:11px;color:rgba(255,255,255,0.4);font-family:ui-monospace,monospace;' +
          'margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
        selectorEl.textContent = c.selector;
        diffRow.appendChild(selectorEl);

        const propLine = document.createElement('div');
        propLine.style.cssText =
          'font-size:12px;font-family:ui-monospace,monospace;display:flex;flex-direction:column;gap:2px';

        const propLabel = document.createElement('span');
        propLabel.style.cssText = 'color:rgba(255,255,255,0.6);font-weight:500';
        propLabel.textContent = c.property;
        propLine.appendChild(propLabel);

        const oldVal = document.createElement('span');
        oldVal.style.cssText = 'color:#ef4444;text-decoration:line-through';
        oldVal.textContent = c.oldValue;
        propLine.appendChild(oldVal);

        const newVal = document.createElement('span');
        newVal.style.cssText = 'color:#22c55e';
        newVal.textContent = c.newValue;
        propLine.appendChild(newVal);

        diffRow.appendChild(propLine);
        fileSection.appendChild(diffRow);
      }

      scrollArea.appendChild(fileSection);
    });

    this._detailEl.appendChild(scrollArea);

    // Trigger slide-in animation
    this._detailEl.getBoundingClientRect();
    this._detailEl.style.opacity = '1';
    this._detailEl.style.transform = 'translateX(0)';
  }

  hideDetail() {
    this._detailEl.style.display = 'none';
    this._detailEl.style.opacity = '0';
    this._detailEl.style.transform = 'translateX(8px)';
    this.listEl.style.display = '';
    // Restore bottom bar visibility based on state
    this._updateClearBtn();
  }

  private render() {
    // Bug fix #3: save scroll position before rebuilding
    const savedScrollTop = this.listEl.scrollTop;

    while (this.listEl.firstChild) this.listEl.removeChild(this.listEl.firstChild);

    // Bug fix #1: filter entries to only actionable ones
    this.filterEntries();

    const mc = this.getMarkerColor();

    if (this.filteredEntries.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:24px 16px;text-align:center;color:rgba(255,255,255,0.35);font-size:12px';
      empty.textContent = 'No changes yet';
      this.listEl.appendChild(empty);
      this._updateClearBtn();
      // Bug fix #3: restore scroll position
      this.listEl.scrollTop = savedScrollTop;
      return;
    }

    this.filteredEntries.forEach((entry, i) => {
      const isReverted = this.revertedPrompts.has(entry.promptId);

      const item = document.createElement('div');
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');

      // Bug fix #4: visual indicator for reverted entries
      let bgColor: string;
      if (isReverted) {
        bgColor = 'rgba(239,68,68,0.08)';
      } else if (i === this.focusedIndex) {
        bgColor = 'rgba(255,255,255,0.06)';
      } else {
        bgColor = 'rgba(255,255,255,0.02)';
      }

      item.style.cssText =
        'padding:10px 12px;border-radius:10px;margin-bottom:6px;cursor:pointer;' +
        'background:' + bgColor + ';' +
        'transition:background 80ms ease;' +
        'opacity:' + (entry.reviewed ? '0.4' : '1');

      const topRow = document.createElement('div');
      topRow.style.cssText = 'display:flex;align-items:flex-start;gap:8px';

      const numCircle = document.createElement('div');
      numCircle.style.cssText =
        'width:20px;height:20px;border-radius:50%;display:flex;align-items:center;' +
        'justify-content:center;flex-shrink:0;background:#D97757';
      numCircle.setAttribute('aria-label', entry.status);
      const numSpan = document.createElement('span');
      numSpan.style.cssText =
        'font-size:10px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;' +
        'font-family:system-ui,sans-serif';
      numSpan.textContent = String(i + 1);
      numCircle.appendChild(numSpan);
      topRow.appendChild(numCircle);

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

      // Diff stats: +N -N
      if (entry.changes.length > 0) {
        const statsWrap = document.createElement('div');
        statsWrap.style.cssText = 'margin-top:4px';

        const statsSpan = document.createElement('span');
        statsSpan.style.cssText = 'font-size:11px;font-family:ui-monospace,monospace';

        const addSpan = document.createElement('span');
        addSpan.style.cssText = 'color:#22c55e';
        addSpan.textContent = '+' + entry.changes.length;

        const sepSpan = document.createElement('span');
        sepSpan.style.cssText = 'color:rgba(255,255,255,0.25)';
        sepSpan.textContent = ' ';

        const delSpan = document.createElement('span');
        delSpan.style.cssText = 'color:#ef4444';
        delSpan.textContent = '-' + entry.changes.length;

        statsSpan.appendChild(addSpan);
        statsSpan.appendChild(sepSpan);
        statsSpan.appendChild(delSpan);
        statsWrap.appendChild(statsSpan);
        summaryEl.appendChild(statsWrap);
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

        // Bug fix #5: rename "Done" to "Mark Done"
        const doneBtn = this.makeActionBtn('Mark Done', () => this.markDone(entry.promptId));
        doneBtn.setAttribute('aria-label', 'Mark change as reviewed');
        actions.appendChild(doneBtn);

        if (entry.changes && entry.changes.length > 0) {
          // Bug fix #4: reverted state for revert button
          if (isReverted) {
            const revertedBtn = this.makeActionBtn('Reverted', () => {});
            revertedBtn.disabled = true;
            revertedBtn.style.opacity = '0.4';
            revertedBtn.style.cursor = 'default';
            revertedBtn.setAttribute('aria-label', 'Change has been reverted');
            actions.appendChild(revertedBtn);
          } else {
            const revertBtn = this.makeActionBtn('Revert', () => {
              if (this.onRevertCallback) this.onRevertCallback(entry.promptId, entry.changes);
              this.revertedPrompts.add(entry.promptId);
              this.render();
            });
            revertBtn.setAttribute('aria-label', 'Revert this change preview');
            actions.appendChild(revertBtn);
          }
        }

        const replyBtn = this.makeActionBtn('Reply', () => this.startReply(i));
        replyBtn.setAttribute('aria-label', 'Reply to this change');
        actions.appendChild(replyBtn);

        item.appendChild(actions);
      }

      // Click anywhere on the item (that isn't a button) opens detail view
      item.addEventListener('click', (e) => {
        // Don't trigger if the click was on a button or input inside the item
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) return;

        this.focusedIndex = i;
        const selectors = [...new Set(entry.changes.map(c => c.selector))];
        if (this.onSelectCallback) this.onSelectCallback(selectors);

        if (this.onItemClickCallback) {
          this.onItemClickCallback(i);
        }
      });

      this.listEl.appendChild(item);
    });
    this._updateClearBtn();

    // Bug fix #3: restore scroll position after rebuilding
    this.listEl.scrollTop = savedScrollTop;
  }

  private _updateClearBtn(): void {
    if (!this._clearReviewedBtn || !this.bottomBar) return;
    const hasReviewed = this.entries.some(e => e.reviewed);
    this.bottomBar.style.display = hasReviewed ? '' : 'none';
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
