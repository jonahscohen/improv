interface DiffLine { t: ' ' | '-' | '+'; oldNo: number | null; newNo: number | null; text: string; }
interface DiffHunk { oldStart: number; newStart: number; header: string; lines: DiffLine[]; }
interface FileDiff { file: string; hunks: DiffHunk[]; }

interface ChangeEntry {
  promptId: string;
  summary: string;
  filesChanged: string[];
  changes: Array<{ selector: string; property: string; oldValue: string; newValue: string }>;
  // Real code diffs (standard unified-diff hunks with line numbers). When present,
  // the panel renders these instead of the selector/property pseudo-diff, and the
  // file open button jumps to the first changed line.
  diffs?: FileDiff[];
  // Issue #1: the DOM selector(s) of the element(s) this task was about, carried
  // from the original prompt. Used so clicking the entry can scroll to + select
  // the target even when there are no per-change selectors (diff-only results).
  targetSelectors?: string[];
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
  private onDoneCallback: ((promptId: string, entry: ChangeEntry) => void) | null = null;
  private onUndoDoneCallback: ((promptId: string, entry: ChangeEntry) => void) | null = null;
  private onRevertCallback: ((promptId: string, changes: any[]) => void) | null = null;
  private onClearReviewedCallback: (() => void) | null = null;
  private onClearAllCallback: (() => void) | null = null;
  private onHideCallback: (() => void) | null = null;
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
      'z-index:2147483647;pointer-events:all;font-family:"JustifySans",system-ui,sans-serif;' +
      'overflow:hidden;opacity:0;transform:translateY(8px);' +
      'transition:opacity 200ms ease,transform 200ms ease';

    const header = document.createElement('div');
    header.style.cssText =
      'padding:14px 16px 10px;border-bottom:1px solid rgba(255,255,255,0.1);' +
      'display:flex;align-items:center;justify-content:space-between;flex-shrink:0';

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;gap:8px';
    const title = document.createElement('span');
    title.id = 'justify-changes-title';
    title.textContent = 'Changes';
    title.style.cssText = 'font-size:13px;font-weight:600;color:rgba(255,255,255,0.85)';
    titleWrap.appendChild(title);
    header.appendChild(titleWrap);
    this.container.setAttribute('aria-labelledby', 'justify-changes-title');

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
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#D97757'; closeBtn.style.color = '#1a1a1a'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'transparent'; closeBtn.style.color = 'rgba(255,255,255,0.5)'; });
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);
    this.container.appendChild(header);

    this.listEl = document.createElement('div');
    this.listEl.setAttribute('role', 'list');
    this.listEl.style.cssText = 'overflow-y:auto;flex:1;padding:8px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.15) transparent';

    // Webkit scrollbar styles
    const scrollStyle = document.createElement('style');
    scrollStyle.textContent = ':host ::-webkit-scrollbar{width:6px}:host ::-webkit-scrollbar-track{background:transparent}:host ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:3px}:host ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.25)}';
    this.container.appendChild(scrollStyle);
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
    // "Clear All" (was "Clear Completed Tasks"): clears the ENTIRE review list in
    // one click and is ALWAYS visible while there are entries - the old button
    // only appeared after you marked something done and only cleared the reviewed
    // ones, so it was easy to lose ("where is the clear button?"). Matches the
    // queue panel's "Clear All".
    this._clearReviewedBtn.textContent = 'Clear All';
    this._clearReviewedBtn.setAttribute('aria-label', 'Clear all changes from the review panel');
    this._clearReviewedBtn.style.cssText =
      'border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.45);font-size:11px;cursor:pointer;' +
      'padding:6px 14px;border-radius:8px;font-family:JustifySans,system-ui,sans-serif;outline:none;transition:background 120ms ease,color 120ms ease,border-color 120ms ease';
    this._clearReviewedBtn.addEventListener('mouseenter', () => { this._clearReviewedBtn!.style.background = '#D97757'; this._clearReviewedBtn!.style.color = '#1a1a1a'; this._clearReviewedBtn!.style.borderColor = '#D97757'; });
    this._clearReviewedBtn.addEventListener('mouseleave', () => { this._clearReviewedBtn!.style.background = 'rgba(255,255,255,0.04)'; this._clearReviewedBtn!.style.color = 'rgba(255,255,255,0.45)'; this._clearReviewedBtn!.style.borderColor = 'rgba(255,255,255,0.12)'; });
    this._clearReviewedBtn.addEventListener('click', () => {
      this.entries = [];
      this.filteredEntries = [];
      if (this.onClearAllCallback) this.onClearAllCallback();
      this.hide();
    });
    this.bottomBar.appendChild(this._clearReviewedBtn);
    this.container.appendChild(this.bottomBar);

    this.boundKeydown = this.handleKeydown.bind(this);
    shadowRoot.appendChild(this.container);
  }

  private handleKeydown(e: KeyboardEvent) {
    if (!this.visible) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
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
        this.markDone(this.filteredEntries[this.focusedIndex].promptId, this.filteredEntries[this.focusedIndex]);
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
      if (entry.status === 'completed') return true;
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
    if (this.onHideCallback) this.onHideCallback();
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
  setOnDone(cb: (promptId: string, entry: ChangeEntry) => void) { this.onDoneCallback = cb; }
  setOnUndoDone(cb: (promptId: string, entry: ChangeEntry) => void) { this.onUndoDoneCallback = cb; }
  setOnRevert(cb: (promptId: string, changes: any[]) => void) { this.onRevertCallback = cb; }
  setOnClearReviewed(cb: () => void) { this.onClearReviewedCallback = cb; }
  setOnClearAll(cb: () => void) { this.onClearAllCallback = cb; }
  setOnSelect(cb: (selectors: string[]) => void) { this.onSelectCallback = cb; }
  setOnItemClick(cb: (index: number) => void) { this.onItemClickCallback = cb; }
  setOnHide(cb: () => void) { this.onHideCallback = cb; }

  private markDone(promptId: string, entry: ChangeEntry) {
    if (this.onDoneCallback) this.onDoneCallback(promptId, entry);
    this.filterEntries();
    this.render();
  }

  private startReply(index: number) {
    const entry = this.filteredEntries[index];
    if (!entry) return;
    const items = this.listEl.querySelectorAll('[role="listitem"]');
    const item = items[index] as HTMLElement;
    if (!item) return;

    let replyWrap = item.querySelector('.justify-reply-wrap') as HTMLDivElement;
    if (replyWrap) { replyWrap.remove(); return; }

    replyWrap = document.createElement('div');
    replyWrap.className = 'justify-reply-wrap';
    replyWrap.style.cssText =
      'display:flex;gap:0;margin-top:8px;align-items:center;' +
      'background:#252525;border:1px solid rgba(255,255,255,0.12);border-radius:22px;' +
      'padding:3px 3px 3px 12px;opacity:0;transform:translateY(6px);' +
      'transition:opacity 180ms ease,transform 180ms cubic-bezier(0.4,0,0.2,1)';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Reply to this change...';
    input.setAttribute('aria-label', 'Reply to change');
    input.style.cssText =
      'flex:1;background:transparent;border:none;border-radius:0;' +
      'padding:4px 0;font-size:12px;color:rgba(255,255,255,0.85);' +
      'outline:none;outline-offset:0;box-shadow:none;' +
      'font-family:JustifySans,system-ui,sans-serif;min-width:0';

    const submitBtn = document.createElement('button');
    submitBtn.setAttribute('aria-label', 'Send reply');
    submitBtn.style.cssText =
      'width:26px;height:26px;border-radius:50%;border:none;background:#D97757;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;' +
      'transition:background 120ms ease,transform 80ms ease;outline:none;padding:0';
    const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrowSvg.setAttribute('width', '12');
    arrowSvg.setAttribute('height', '12');
    arrowSvg.setAttribute('viewBox', '0 0 24 24');
    arrowSvg.setAttribute('fill', 'none');
    arrowSvg.setAttribute('stroke', '#1a1a1a');
    arrowSvg.setAttribute('stroke-width', '2.5');
    arrowSvg.setAttribute('stroke-linecap', 'round');
    arrowSvg.setAttribute('stroke-linejoin', 'round');
    const arrPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrPath.setAttribute('d', 'M5 12h14');
    arrowSvg.appendChild(arrPath);
    const arrHead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrHead.setAttribute('d', 'm12 5 7 7-7 7');
    arrowSvg.appendChild(arrHead);
    submitBtn.appendChild(arrowSvg);
    submitBtn.addEventListener('mouseenter', () => { submitBtn.style.background = '#c4623e'; });
    submitBtn.addEventListener('mouseleave', () => { submitBtn.style.background = '#D97757'; });
    submitBtn.addEventListener('mousedown', () => { submitBtn.style.transform = 'scale(0.92)'; });
    submitBtn.addEventListener('mouseup', () => { submitBtn.style.transform = 'scale(1)'; });

    const doSend = () => {
      const replyText = input.value.trim();
      if (!replyText) return;
      input.disabled = true;
      submitBtn.style.display = 'none';
      input.value = 'Sending...';
      input.style.color = 'rgba(255,255,255,0.35)';
      if (this.onReplyCallback) this.onReplyCallback(entry.promptId, replyText);
      setTimeout(() => {
        input.value = 'Sent';
        input.style.color = '#22c55e';
        setTimeout(() => replyWrap.remove(), 800);
      }, 300);
    };

    submitBtn.addEventListener('click', (e) => { e.stopPropagation(); doSend(); });
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') doSend();
      else if (e.key === 'Escape') replyWrap.remove();
    });

    replyWrap.appendChild(input);
    replyWrap.appendChild(submitBtn);
    item.appendChild(replyWrap);

    // Trigger slide-fade in
    replyWrap.getBoundingClientRect();
    replyWrap.style.opacity = '1';
    replyWrap.style.transform = 'translateY(0)';
    input.focus();
  }

  // The original "Open With" split button (icon opens the file; chevron picks the
  // editor). Shared by the legacy CSS-tweak render and the real-diff render. When
  // `line` > 0 the open request carries it so code/cursor jump to that line.
  private _buildOpenWith(filename: string, line: number): HTMLDivElement {
    const openWrap = document.createElement('div');
    openWrap.style.cssText = 'display:flex;align-items:center;gap:4px;flex-shrink:0;position:relative';

    const openLabel = document.createElement('span');
    openLabel.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.3);white-space:nowrap';
    openLabel.textContent = 'Open With';
    openWrap.appendChild(openLabel);

    // Split button container: [icon side | chevron side]
    const splitBtn = document.createElement('div');
    splitBtn.style.cssText =
      'display:flex;align-items:stretch;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden';

    // Left side: icon that opens file
    const iconSide = document.createElement('button');
    iconSide.style.cssText =
      'display:flex;align-items:center;justify-content:center;border:none;background:transparent;' +
      'padding:4px 6px;cursor:pointer;color:rgba(255,255,255,0.5);' +
      'transition:background 120ms ease;outline:none';
    iconSide.addEventListener('mouseenter', () => { iconSide.style.background = 'rgba(255,255,255,0.1)'; });
    iconSide.addEventListener('mouseleave', () => { iconSide.style.background = 'transparent'; });
    iconSide.addEventListener('mousedown', () => { iconSide.style.transform = 'scale(0.92)'; });
    iconSide.addEventListener('mouseup', () => { iconSide.style.transform = ''; });

    const btnIcon = document.createElement('span');
    btnIcon.style.cssText = 'width:14px;height:14px;display:flex;align-items:center;justify-content:center';
    btnIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="14" height="14" fill="currentColor"><path d="M 5 5 A 1.0001 1.0001 0 0 0 4.78125 5.0214844 C 3.7808601 5.1318811 3 5.9700688 3 7 L 3 23 C 3 24.030595 3.7818815 24.868998 4.7832031 24.978516 A 1.0001 1.0001 0 0 0 5 25 L 17 25 L 25 25 C 26.093063 25 27 24.093063 27 23 L 27 7 C 27 5.9069372 26.093063 5 25 5 L 16 5 L 5 5 z M 14.888672 7 L 25 7 L 25 23 L 16.697266 23 C 16.603409 22.358906 16.508612 21.714695 16.408203 20.917969 C 15.958203 20.968969 15.49 21 15 21 C 10.808 21 8.007625 18.882969 7.890625 18.792969 C 7.452625 18.455969 7.3700313 17.827625 7.7070312 17.390625 C 8.0430312 16.952625 8.6694219 16.870078 9.1074219 17.205078 C 9.1524219 17.238078 11.53 19 15 19 C 15.412 19 15.803641 18.972688 16.181641 18.929688 C 16.074641 17.852688 16 16.815 16 16 L 13.685547 16 C 13.309547 16 12.998766 15.685594 13.009766 15.308594 C 13.117156 11.534421 14.082118 8.7333804 14.888672 7 z M 16.181641 18.929688 C 16.247641 19.591687 16.326203 20.266969 16.408203 20.917969 C 19.808203 20.530969 22.005375 18.872969 22.109375 18.792969 C 22.546375 18.455969 22.629969 17.827625 22.292969 17.390625 C 21.955969 16.951625 21.327625 16.871031 20.890625 17.207031 C 20.870625 17.223031 19.032641 18.605688 16.181641 18.929688 z M 20.984375 9.9863281 A 1.0001 1.0001 0 0 0 20 11 L 20 12 A 1.0001 1.0001 0 1 0 22 12 L 22 11 A 1.0001 1.0001 0 0 0 20.984375 9.9863281 z M 9 10 C 9.552 10 10 10.447 10 11 L 10 12 C 10 12.553 9.552 13 9 13 C 8.448 13 8 12.553 8 12 L 8 11 C 8 10.447 8.448 10 9 10 z"/></svg>';
    iconSide.appendChild(btnIcon);

    let selectedCmd = 'open';
    iconSide.addEventListener('click', (e) => {
      e.stopPropagation();
      fetch('http://localhost:9223/open-file', {
        method: 'POST',
        body: JSON.stringify({ file: filename, cmd: selectedCmd, line })
      }).catch(() => {});
    });

    // Divider between icon and chevron
    const splitDiv = document.createElement('div');
    splitDiv.style.cssText = 'width:1px;background:rgba(255,255,255,0.1);flex-shrink:0';

    // Right side: chevron that opens dropdown
    const chevSide = document.createElement('button');
    chevSide.style.cssText =
      'display:flex;align-items:center;justify-content:center;border:none;background:transparent;' +
      'padding:4px 4px;cursor:pointer;color:rgba(255,255,255,0.5);' +
      'transition:background 120ms ease;outline:none';
    chevSide.addEventListener('mouseenter', () => { chevSide.style.background = 'rgba(255,255,255,0.1)'; });
    chevSide.addEventListener('mouseleave', () => { chevSide.style.background = 'transparent'; });
    chevSide.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

    splitBtn.appendChild(iconSide);
    splitBtn.appendChild(splitDiv);
    splitBtn.appendChild(chevSide);

    const editorIcons: Record<string, string> = {
      cursor: '<svg fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z"></path></svg>',
      vscode: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M22 5.75v12.48c0 .49-.28.94-.72 1.15-.91.43-2.46 1.18-3.33 1.59.03-.16.05-.33.05-.5V3.53C18 3.3 17.97 3.12 17.94 3c.94.46 2.44 1.18 3.33 1.6C21.72 4.81 22 5.26 22 5.75zM3.91 13.35c.89.8 1.73 1.56 2.51 2.28l-1.48 1.12c-.37.28-.89.27-1.25-.03l-.94-.79c-.46-.39-.48-1.09-.03-1.5C3.05 14.13 3.46 13.76 3.91 13.35zM16 3.53v4.81l-3.16 2.4-3.3-2.5c2.29-2.07 4.46-4.05 5.59-5.1.23-.22.56-.16.74.04.05.06.09.13.11.22C15.99 3.44 16 3.48 16 3.53zM16 20.47v-4.81L4.938 7.252c-.372-.283-.889-.27-1.247.03L2.754 8.066C2.289 8.456 2.271 9.162 2.72 9.569c2.747 2.488 9.998 9.06 12.41 11.291C15.462 21.167 16 20.93 16 20.47z"/></svg>',
      finder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="14" height="14" fill="currentColor"><path d="M 5 5 A 1.0001 1.0001 0 0 0 4.78125 5.0214844 C 3.7808601 5.1318811 3 5.9700688 3 7 L 3 23 C 3 24.030595 3.7818815 24.868998 4.7832031 24.978516 A 1.0001 1.0001 0 0 0 5 25 L 17 25 L 25 25 C 26.093063 25 27 24.093063 27 23 L 27 7 C 27 5.9069372 26.093063 5 25 5 L 16 5 L 5 5 z M 14.888672 7 L 25 7 L 25 23 L 16.697266 23 C 16.603409 22.358906 16.508612 21.714695 16.408203 20.917969 C 15.958203 20.968969 15.49 21 15 21 C 10.808 21 8.007625 18.882969 7.890625 18.792969 C 7.452625 18.455969 7.3700313 17.827625 7.7070312 17.390625 C 8.0430312 16.952625 8.6694219 16.870078 9.1074219 17.205078 C 9.1524219 17.238078 11.53 19 15 19 C 15.412 19 15.803641 18.972688 16.181641 18.929688 C 16.074641 17.852688 16 16.815 16 16 L 13.685547 16 C 13.309547 16 12.998766 15.685594 13.009766 15.308594 C 13.117156 11.534421 14.082118 8.7333804 14.888672 7 z M 16.181641 18.929688 C 16.247641 19.591687 16.326203 20.266969 16.408203 20.917969 C 19.808203 20.530969 22.005375 18.872969 22.109375 18.792969 C 22.546375 18.455969 22.629969 17.827625 22.292969 17.390625 C 21.955969 16.951625 21.327625 16.871031 20.890625 17.207031 C 20.870625 17.223031 19.032641 18.605688 16.181641 18.929688 z M 20.984375 9.9863281 A 1.0001 1.0001 0 0 0 20 11 L 20 12 A 1.0001 1.0001 0 1 0 22 12 L 22 11 A 1.0001 1.0001 0 0 0 20.984375 9.9863281 z M 9 10 C 9.552 10 10 10.447 10 11 L 10 12 C 10 12.553 9.552 13 9 13 C 8.448 13 8 12.553 8 12 L 8 11 C 8 10.447 8.448 10 9 10 z"/></svg>',
      opencode: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
    };

    let dropdownOpen = false;
    let dropdown: HTMLDivElement | null = null;

    chevSide.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdownOpen && dropdown) {
        dropdown.remove();
        dropdown = null;
        dropdownOpen = false;
        return;
      }

      dropdown = document.createElement('div');
      const btnRect = splitBtn.getBoundingClientRect();
      dropdown.style.cssText =
        'position:fixed;background:#1a1a1a;' +
        'border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:4px;' +
        'box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:2147483647;min-width:120px;' +
        'opacity:0;transform:translateY(-4px);transition:opacity 120ms ease,transform 120ms ease';
      dropdown.style.top = (btnRect.bottom + 4) + 'px';
      dropdown.style.right = (window.innerWidth - btnRect.right) + 'px';

      const editors = [
        { key: 'cursor', label: 'Cursor', cmd: 'cursor' },
        { key: 'vscode', label: 'VS Code', cmd: 'code' },
        { key: 'opencode', label: 'OpenCode', cmd: 'opencode' },
        { key: 'finder', label: 'Finder', cmd: 'open' },
      ];

      for (const ed of editors) {
        const row = document.createElement('button');
        row.style.cssText =
          'display:flex;align-items:center;gap:8px;width:100%;border:none;background:none;' +
          'padding:6px 10px;cursor:pointer;border-radius:6px;color:rgba(255,255,255,0.7);' +
          'font-size:12px;font-family:JustifySans,system-ui,sans-serif;outline:none;' +
          'transition:background 80ms ease';
        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.08)'; });
        row.addEventListener('mouseleave', () => { row.style.background = 'none'; });

        const icon = document.createElement('span');
        icon.style.cssText = 'width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0';
        icon.innerHTML = editorIcons[ed.key];
        row.appendChild(icon);

        const lbl = document.createElement('span');
        lbl.textContent = ed.label;
        row.appendChild(lbl);

        row.addEventListener('click', (ev) => {
          ev.stopPropagation();
          btnIcon.innerHTML = editorIcons[ed.key];
          selectedCmd = ed.cmd;
          if (dropdown) { dropdown.remove(); dropdown = null; }
          dropdownOpen = false;
        });

        dropdown.appendChild(row);
      }

      document.body.appendChild(dropdown);
      dropdown.getBoundingClientRect();
      dropdown.style.opacity = '1';
      dropdown.style.transform = 'translateY(0)';
      dropdownOpen = true;

      const closeDropdown = (ev: MouseEvent) => {
        const path = ev.composedPath();
        const hitDropdown = dropdown && path.some(n => n === dropdown);
        const hitSplit = path.some(n => n === splitBtn);
        if (dropdown && !hitDropdown && !hitSplit) {
          dropdown.remove();
          dropdown = null;
          dropdownOpen = false;
          document.removeEventListener('click', closeDropdown, true);
        }
      };
      setTimeout(() => {
        document.addEventListener('click', closeDropdown, true);
      }, 0);
    });

    openWrap.appendChild(splitBtn);
    return openWrap;
  }

  // First *actually changed* line of a file as a new-file line number, for the
  // open-at-line jump. Walks past leading context so the editor lands on the real
  // change, not the hunk's context start. For a deletion (no new line of its own),
  // returns the new-file position where the deletion occurred.
  private _firstChangedLine(fd: FileDiff): number {
    for (const h of fd.hunks) {
      let lastNew = h.newStart - 1;
      for (const ln of h.lines) {
        if (ln.t === '+') return ln.newNo != null ? ln.newNo : lastNew + 1;
        if (ln.t === '-') return lastNew + 1;
        if (ln.newNo != null) lastNew = ln.newNo;
      }
      return h.newStart;
    }
    return 0;
  }

  // Render real unified-diff hunks - standard +/- rows with an old|new line-number
  // gutter - per file, with an "Open" button that jumps the editor to the first
  // changed line. This is the standardized code-diff view for the Review panel.
  private _renderFileDiffs(scrollArea: HTMLElement, fileDiffs: FileDiff[]) {
    for (const fd of fileDiffs) {
      const firstLine = this._firstChangedLine(fd);
      const fileSection = document.createElement('div');
      fileSection.style.cssText = 'margin-bottom:16px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.06)';

      const fileHeader = document.createElement('div');
      fileHeader.style.cssText =
        'font-size:12px;color:rgba(255,255,255,0.5);font-family:JustifySans,system-ui,sans-serif;' +
        'padding:6px 8px 6px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);' +
        'display:flex;align-items:center;justify-content:space-between;gap:8px';

      const fileLabel = document.createElement('span');
      fileLabel.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      // Filename only (basename), in ImprovSans - matches the original header.
      fileLabel.textContent = fd.file.split('/').pop() || fd.file;
      fileLabel.title = fd.file;
      fileHeader.appendChild(fileLabel);

      // The original "Open With" split-button picker, carrying the first changed
      // line so a selected editor (code/cursor) jumps straight to it.
      fileHeader.appendChild(this._buildOpenWith(fd.file, firstLine));
      fileSection.appendChild(fileHeader);

      for (const hunk of fd.hunks) {
        const hunkHeader = document.createElement('div');
        hunkHeader.style.cssText =
          'font-size:11px;color:rgba(125,211,252,0.75);font-family:JustifyMono,ui-monospace,monospace;' +
          'padding:4px 12px;background:rgba(56,189,248,0.06);white-space:pre-wrap;word-break:break-word';
        hunkHeader.textContent = `@@ -${hunk.oldStart} +${hunk.newStart} @@` + (hunk.header ? ' ' + hunk.header : '');
        fileSection.appendChild(hunkHeader);

        for (const ln of hunk.lines) {
          const row = document.createElement('div');
          const bg = ln.t === '+' ? 'rgba(34,197,94,0.12)' : ln.t === '-' ? 'rgba(239,68,68,0.12)' : 'transparent';
          row.style.cssText =
            'display:flex;font-size:12px;font-family:JustifyMono,ui-monospace,monospace;line-height:1.5;background:' + bg;

          const gutter = document.createElement('span');
          gutter.style.cssText = 'flex-shrink:0;display:flex;user-select:none;border-right:1px solid rgba(255,255,255,0.06)';
          const oldG = document.createElement('span');
          oldG.style.cssText = 'width:34px;text-align:right;padding:1px 6px;color:rgba(255,255,255,0.22)';
          oldG.textContent = ln.oldNo != null ? String(ln.oldNo) : '';
          const newG = document.createElement('span');
          newG.style.cssText = 'width:34px;text-align:right;padding:1px 6px;color:rgba(255,255,255,0.32)';
          newG.textContent = ln.newNo != null ? String(ln.newNo) : '';
          gutter.appendChild(oldG);
          gutter.appendChild(newG);
          row.appendChild(gutter);

          const mark = document.createElement('span');
          mark.style.cssText = 'flex-shrink:0;width:16px;text-align:center;user-select:none;color:' +
            (ln.t === '+' ? '#22c55e' : ln.t === '-' ? '#ef4444' : 'rgba(255,255,255,0.3)');
          mark.textContent = ln.t === ' ' ? '' : ln.t;
          row.appendChild(mark);

          const code = document.createElement('span');
          code.style.cssText = 'white-space:pre-wrap;word-break:break-word;color:rgba(255,255,255,0.82);padding-right:10px;flex:1';
          code.textContent = ln.text;
          row.appendChild(code);

          fileSection.appendChild(row);
        }
      }
      scrollArea.appendChild(fileSection);
    }
  }

  showDetail(entry: ChangeEntry, index: number) {
    // Slide list out to the left
    this.listEl.style.transition = 'opacity 200ms ease,transform 200ms cubic-bezier(0.4,0,0.2,1)';
    this.listEl.style.opacity = '0';
    this.listEl.style.transform = 'translateX(-16px)';
    this.bottomBar.style.transition = 'opacity 150ms ease';
    this.bottomBar.style.opacity = '0';

    setTimeout(() => {
      this.listEl.style.display = 'none';
      this.bottomBar.style.display = 'none';
      this._showDetailContent(entry, index);
    }, 200);
  }

  private _showDetailContent(entry: ChangeEntry, index: number) {
    // Clear and populate detail container
    while (this._detailEl.firstChild) this._detailEl.removeChild(this._detailEl.firstChild);
    this._detailEl.style.display = 'flex';
    this._detailEl.style.flexDirection = 'column';
    this._detailEl.style.opacity = '0';
    this._detailEl.style.transform = 'translateX(16px)';

    // Back button
    const backBtn = document.createElement('button');
    backBtn.style.cssText =
      'display:flex;align-items:center;gap:6px;border:none;background:none;' +
      'color:rgba(255,255,255,0.6);font-size:12px;cursor:pointer;padding:12px 16px;' +
      'font-family:JustifySans,system-ui,sans-serif;outline:none;flex-shrink:0;' +
      'transition:color 120ms ease';
    backBtn.addEventListener('mouseenter', () => { backBtn.style.background = '#D97757'; backBtn.style.color = '#1a1a1a'; });
    backBtn.addEventListener('mouseleave', () => { backBtn.style.background = 'none'; backBtn.style.color = 'rgba(255,255,255,0.6)'; });

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
      'font-size:10px;font-weight:700;color:#1a1a1a;font-variant-numeric:tabular-nums;' +
      'font-family:JustifySans,system-ui,sans-serif;margin-right:8px;vertical-align:middle';
    numLabel.textContent = String(index + 1);
    summaryHeader.appendChild(numLabel);

    const summarySpan = document.createElement('span');
    summarySpan.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.85);line-height:1.4';
    summarySpan.textContent = entry.summary;
    summaryHeader.appendChild(summarySpan);

    scrollArea.appendChild(summaryHeader);

    // Group changes by file - filter out compiled/build artifacts, deduplicate
    const changes = entry.changes || [];
    const allFiles = entry.filesChanged || [];
    const compiledExts = ['.css', '.min.css', '.min.js', '.map'];
    const sourceExts = ['.scss', '.sass', '.less', '.styl', '.ts', '.tsx', '.jsx', '.vue', '.svelte'];
    const files = allFiles.filter(f => {
      const ext = '.' + f.split('.').pop();
      if (!compiledExts.includes(ext)) return true;
      const base = f.replace(/\.[^.]+$/, '');
      return !allFiles.some(other => other !== f && sourceExts.some(se => other.endsWith(base.split('/').pop() + se) || other.replace(/\.[^.]+$/, '').endsWith(base.split('/').pop()!)));
    });
    if (files.length === 0 && allFiles.length > 0) files.push(allFiles[0]);

    const changesByFile = new Map<string, Array<{ selector: string; property: string; oldValue: string; newValue: string }>>();

    for (const f of files) {
      if (!changesByFile.has(f)) changesByFile.set(f, []);
    }

    for (const c of changes) {
      if (files.length === 1) {
        changesByFile.get(files[0])!.push(c);
      } else {
        for (const f of files) {
          if (!changesByFile.has(f)) changesByFile.set(f, []);
          changesByFile.get(f)!.push(c);
        }
      }
    }

    // Real unified diffs (standard +/- with line numbers) are the requested
    // format and take precedence; the selector/property pseudo-diff below is the
    // fallback for visual CSS tweaks that carry no real diff.
    const fileDiffs = entry.diffs || [];
    if (fileDiffs.length > 0) {
      this._renderFileDiffs(scrollArea, fileDiffs);
    } else {
    // Render each file group as inline diffs
    changesByFile.forEach((fileChanges, filename) => {
      const fileSection = document.createElement('div');
      fileSection.style.cssText = 'margin-bottom:16px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.06)';

      const fileHeader = document.createElement('div');
      fileHeader.style.cssText =
        'font-size:12px;color:rgba(255,255,255,0.5);font-family:JustifySans,system-ui,sans-serif;' +
        'padding:6px 8px 6px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);' +
        'display:flex;align-items:center;justify-content:space-between;gap:8px';

      const fileLabel = document.createElement('span');
      fileLabel.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      fileLabel.textContent = filename.split('/').pop() || filename;
      fileLabel.title = filename;
      fileHeader.appendChild(fileLabel);

      // "Open With" split button
      const openWrap = document.createElement('div');
      openWrap.style.cssText = 'display:flex;align-items:center;gap:4px;flex-shrink:0;position:relative';

      const openLabel = document.createElement('span');
      openLabel.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.3);white-space:nowrap';
      openLabel.textContent = 'Open With';
      openWrap.appendChild(openLabel);

      // Split button container: [icon side | chevron side]
      const splitBtn = document.createElement('div');
      splitBtn.style.cssText =
        'display:flex;align-items:stretch;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden';

      // Left side: icon that opens file
      const iconSide = document.createElement('button');
      iconSide.style.cssText =
        'display:flex;align-items:center;justify-content:center;border:none;background:transparent;' +
        'padding:4px 6px;cursor:pointer;color:rgba(255,255,255,0.5);' +
        'transition:background 120ms ease;outline:none';
      iconSide.addEventListener('mouseenter', () => { iconSide.style.background = 'rgba(255,255,255,0.1)'; });
      iconSide.addEventListener('mouseleave', () => { iconSide.style.background = 'transparent'; });
      iconSide.addEventListener('mousedown', () => { iconSide.style.transform = 'scale(0.92)'; });
      iconSide.addEventListener('mouseup', () => { iconSide.style.transform = ''; });

      const btnIcon = document.createElement('span');
      btnIcon.style.cssText = 'width:14px;height:14px;display:flex;align-items:center;justify-content:center';
      btnIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="14" height="14" fill="currentColor"><path d="M 5 5 A 1.0001 1.0001 0 0 0 4.78125 5.0214844 C 3.7808601 5.1318811 3 5.9700688 3 7 L 3 23 C 3 24.030595 3.7818815 24.868998 4.7832031 24.978516 A 1.0001 1.0001 0 0 0 5 25 L 17 25 L 25 25 C 26.093063 25 27 24.093063 27 23 L 27 7 C 27 5.9069372 26.093063 5 25 5 L 16 5 L 5 5 z M 14.888672 7 L 25 7 L 25 23 L 16.697266 23 C 16.603409 22.358906 16.508612 21.714695 16.408203 20.917969 C 15.958203 20.968969 15.49 21 15 21 C 10.808 21 8.007625 18.882969 7.890625 18.792969 C 7.452625 18.455969 7.3700313 17.827625 7.7070312 17.390625 C 8.0430312 16.952625 8.6694219 16.870078 9.1074219 17.205078 C 9.1524219 17.238078 11.53 19 15 19 C 15.412 19 15.803641 18.972688 16.181641 18.929688 C 16.074641 17.852688 16 16.815 16 16 L 13.685547 16 C 13.309547 16 12.998766 15.685594 13.009766 15.308594 C 13.117156 11.534421 14.082118 8.7333804 14.888672 7 z M 16.181641 18.929688 C 16.247641 19.591687 16.326203 20.266969 16.408203 20.917969 C 19.808203 20.530969 22.005375 18.872969 22.109375 18.792969 C 22.546375 18.455969 22.629969 17.827625 22.292969 17.390625 C 21.955969 16.951625 21.327625 16.871031 20.890625 17.207031 C 20.870625 17.223031 19.032641 18.605688 16.181641 18.929688 z M 20.984375 9.9863281 A 1.0001 1.0001 0 0 0 20 11 L 20 12 A 1.0001 1.0001 0 1 0 22 12 L 22 11 A 1.0001 1.0001 0 0 0 20.984375 9.9863281 z M 9 10 C 9.552 10 10 10.447 10 11 L 10 12 C 10 12.553 9.552 13 9 13 C 8.448 13 8 12.553 8 12 L 8 11 C 8 10.447 8.448 10 9 10 z"/></svg>';
      iconSide.appendChild(btnIcon);

      let selectedCmd = 'open';
      iconSide.addEventListener('click', (e) => {
        e.stopPropagation();
        fetch('http://localhost:9223/open-file', {
          method: 'POST',
          body: JSON.stringify({ file: filename, cmd: selectedCmd })
        }).catch(() => {});
      });

      // Divider between icon and chevron
      const splitDiv = document.createElement('div');
      splitDiv.style.cssText = 'width:1px;background:rgba(255,255,255,0.1);flex-shrink:0';

      // Right side: chevron that opens dropdown
      const chevSide = document.createElement('button');
      chevSide.style.cssText =
        'display:flex;align-items:center;justify-content:center;border:none;background:transparent;' +
        'padding:4px 4px;cursor:pointer;color:rgba(255,255,255,0.5);' +
        'transition:background 120ms ease;outline:none';
      chevSide.addEventListener('mouseenter', () => { chevSide.style.background = 'rgba(255,255,255,0.1)'; });
      chevSide.addEventListener('mouseleave', () => { chevSide.style.background = 'transparent'; });
      chevSide.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

      splitBtn.appendChild(iconSide);
      splitBtn.appendChild(splitDiv);
      splitBtn.appendChild(chevSide);

      const editorIcons: Record<string, string> = {
        cursor: '<svg fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z"></path></svg>',
        vscode: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M22 5.75v12.48c0 .49-.28.94-.72 1.15-.91.43-2.46 1.18-3.33 1.59.03-.16.05-.33.05-.5V3.53C18 3.3 17.97 3.12 17.94 3c.94.46 2.44 1.18 3.33 1.6C21.72 4.81 22 5.26 22 5.75zM3.91 13.35c.89.8 1.73 1.56 2.51 2.28l-1.48 1.12c-.37.28-.89.27-1.25-.03l-.94-.79c-.46-.39-.48-1.09-.03-1.5C3.05 14.13 3.46 13.76 3.91 13.35zM16 3.53v4.81l-3.16 2.4-3.3-2.5c2.29-2.07 4.46-4.05 5.59-5.1.23-.22.56-.16.74.04.05.06.09.13.11.22C15.99 3.44 16 3.48 16 3.53zM16 20.47v-4.81L4.938 7.252c-.372-.283-.889-.27-1.247.03L2.754 8.066C2.289 8.456 2.271 9.162 2.72 9.569c2.747 2.488 9.998 9.06 12.41 11.291C15.462 21.167 16 20.93 16 20.47z"/></svg>',
        finder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="14" height="14" fill="currentColor"><path d="M 5 5 A 1.0001 1.0001 0 0 0 4.78125 5.0214844 C 3.7808601 5.1318811 3 5.9700688 3 7 L 3 23 C 3 24.030595 3.7818815 24.868998 4.7832031 24.978516 A 1.0001 1.0001 0 0 0 5 25 L 17 25 L 25 25 C 26.093063 25 27 24.093063 27 23 L 27 7 C 27 5.9069372 26.093063 5 25 5 L 16 5 L 5 5 z M 14.888672 7 L 25 7 L 25 23 L 16.697266 23 C 16.603409 22.358906 16.508612 21.714695 16.408203 20.917969 C 15.958203 20.968969 15.49 21 15 21 C 10.808 21 8.007625 18.882969 7.890625 18.792969 C 7.452625 18.455969 7.3700313 17.827625 7.7070312 17.390625 C 8.0430312 16.952625 8.6694219 16.870078 9.1074219 17.205078 C 9.1524219 17.238078 11.53 19 15 19 C 15.412 19 15.803641 18.972688 16.181641 18.929688 C 16.074641 17.852688 16 16.815 16 16 L 13.685547 16 C 13.309547 16 12.998766 15.685594 13.009766 15.308594 C 13.117156 11.534421 14.082118 8.7333804 14.888672 7 z M 16.181641 18.929688 C 16.247641 19.591687 16.326203 20.266969 16.408203 20.917969 C 19.808203 20.530969 22.005375 18.872969 22.109375 18.792969 C 22.546375 18.455969 22.629969 17.827625 22.292969 17.390625 C 21.955969 16.951625 21.327625 16.871031 20.890625 17.207031 C 20.870625 17.223031 19.032641 18.605688 16.181641 18.929688 z M 20.984375 9.9863281 A 1.0001 1.0001 0 0 0 20 11 L 20 12 A 1.0001 1.0001 0 1 0 22 12 L 22 11 A 1.0001 1.0001 0 0 0 20.984375 9.9863281 z M 9 10 C 9.552 10 10 10.447 10 11 L 10 12 C 10 12.553 9.552 13 9 13 C 8.448 13 8 12.553 8 12 L 8 11 C 8 10.447 8.448 10 9 10 z"/></svg>',
        opencode: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
      };

      let dropdownOpen = false;
      let dropdown: HTMLDivElement | null = null;

      chevSide.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdownOpen && dropdown) {
          dropdown.remove();
          dropdown = null;
          dropdownOpen = false;
          return;
        }

        dropdown = document.createElement('div');
        const btnRect = splitBtn.getBoundingClientRect();
        dropdown.style.cssText =
          'position:fixed;background:#1a1a1a;' +
          'border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:4px;' +
          'box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:2147483647;min-width:120px;' +
          'opacity:0;transform:translateY(-4px);transition:opacity 120ms ease,transform 120ms ease';
        dropdown.style.top = (btnRect.bottom + 4) + 'px';
        dropdown.style.right = (window.innerWidth - btnRect.right) + 'px';

        const editors = [
          { key: 'cursor', label: 'Cursor', cmd: 'cursor' },
          { key: 'vscode', label: 'VS Code', cmd: 'code' },
          { key: 'opencode', label: 'OpenCode', cmd: 'opencode' },
          { key: 'finder', label: 'Finder', cmd: 'open' },
        ];

        for (const ed of editors) {
          const row = document.createElement('button');
          row.style.cssText =
            'display:flex;align-items:center;gap:8px;width:100%;border:none;background:none;' +
            'padding:6px 10px;cursor:pointer;border-radius:6px;color:rgba(255,255,255,0.7);' +
            'font-size:12px;font-family:JustifySans,system-ui,sans-serif;outline:none;' +
            'transition:background 80ms ease';
          row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.08)'; });
          row.addEventListener('mouseleave', () => { row.style.background = 'none'; });

          const icon = document.createElement('span');
          icon.style.cssText = 'width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0';
          icon.innerHTML = editorIcons[ed.key];
          row.appendChild(icon);

          const lbl = document.createElement('span');
          lbl.textContent = ed.label;
          row.appendChild(lbl);

          row.addEventListener('click', (ev) => {
            ev.stopPropagation();
            btnIcon.innerHTML = editorIcons[ed.key];
            selectedCmd = ed.cmd;
            if (dropdown) { dropdown.remove(); dropdown = null; }
            dropdownOpen = false;
          });

          dropdown.appendChild(row);
        }

        document.body.appendChild(dropdown);
        dropdown.getBoundingClientRect();
        dropdown.style.opacity = '1';
        dropdown.style.transform = 'translateY(0)';
        dropdownOpen = true;

        const closeDropdown = (ev: MouseEvent) => {
          const path = ev.composedPath();
          const hitDropdown = dropdown && path.some(n => n === dropdown);
          const hitSplit = path.some(n => n === splitBtn);
          if (dropdown && !hitDropdown && !hitSplit) {
            dropdown.remove();
            dropdown = null;
            dropdownOpen = false;
            document.removeEventListener('click', closeDropdown, true);
          }
        };
        setTimeout(() => {
          document.addEventListener('click', closeDropdown, true);
        }, 0);
      });

      openWrap.appendChild(splitBtn);
      fileHeader.appendChild(openWrap);
      fileSection.appendChild(fileHeader);

      for (const c of fileChanges) {
        // Tolerant row: payloads that carry a prose description (or only a
        // file reference) instead of a selector/property diff render as a
        // plain description line - never as an undefined-filled diff.
        const loose = c as { selector?: string; property?: string; oldValue?: string; newValue?: string; description?: string; file?: string };
        if (!loose.selector && !loose.property) {
          const descEl = document.createElement('div');
          descEl.style.cssText =
            'font-size:12px;color:rgba(255,255,255,0.7);padding:8px 12px;line-height:1.45';
          descEl.textContent = loose.description || loose.file || '(no detail provided)';
          fileSection.appendChild(descEl);
          continue;
        }
        const selectorEl = document.createElement('div');
        selectorEl.style.cssText =
          'font-size:10px;color:rgba(255,255,255,0.35);font-family:JustifyMono,ui-monospace,monospace;' +
          'padding:6px 12px 2px;word-break:break-all';
        selectorEl.textContent = (c.selector || '(page)') + ' {';
        fileSection.appendChild(selectorEl);

        const oldLine = document.createElement('div');
        oldLine.style.cssText =
          'font-size:12px;font-family:JustifyMono,ui-monospace,monospace;' +
          'padding:3px 12px;background:rgba(239,68,68,0.12);display:flex;gap:6px';
        const oldMark = document.createElement('span');
        oldMark.style.cssText = 'color:#ef4444;flex-shrink:0;user-select:none';
        oldMark.textContent = '-';
        oldLine.appendChild(oldMark);
        const oldText = document.createElement('span');
        oldText.style.cssText = 'color:rgba(255,255,255,0.7)';
        oldText.innerHTML = (c.property || 'value') + ': <span style="color:#ef4444;background:rgba(239,68,68,0.2);padding:0 3px;border-radius:2px">' +
          this.escapeHtml(c.oldValue ?? '') + '</span>;';
        oldLine.appendChild(oldText);
        fileSection.appendChild(oldLine);

        const newLine = document.createElement('div');
        newLine.style.cssText =
          'font-size:12px;font-family:JustifyMono,ui-monospace,monospace;' +
          'padding:3px 12px;background:rgba(34,197,94,0.12);display:flex;gap:6px';
        const newMark = document.createElement('span');
        newMark.style.cssText = 'color:#22c55e;flex-shrink:0;user-select:none';
        newMark.textContent = '+';
        newLine.appendChild(newMark);
        const newText = document.createElement('span');
        newText.style.cssText = 'color:rgba(255,255,255,0.7)';
        newText.innerHTML = (c.property || 'value') + ': <span style="color:#22c55e;background:rgba(34,197,94,0.2);padding:0 3px;border-radius:2px">' +
          this.escapeHtml(c.newValue ?? '') + '</span>;';
        newLine.appendChild(newText);
        fileSection.appendChild(newLine);

        const closeBrace = document.createElement('div');
        closeBrace.style.cssText =
          'font-size:10px;color:rgba(255,255,255,0.35);font-family:JustifyMono,ui-monospace,monospace;' +
          'padding:2px 12px 6px';
        closeBrace.textContent = '}';
        fileSection.appendChild(closeBrace);
      }

      scrollArea.appendChild(fileSection);
    });
    } // end legacy selector/property render (real-diff path handled above)

    // Action buttons underneath the diffs
    if (!entry.reviewed) {
      const detailActions = document.createElement('div');
      detailActions.style.cssText = 'display:flex;gap:6px;margin-top:12px;padding-bottom:8px';

      const doneBtn = this.makeActionBtn('Mark Done', () => { this.markDone(entry.promptId, entry); this.hideDetail(); });
      detailActions.appendChild(doneBtn);

      if (changes.length > 0 || (entry.diffs || []).length > 0) {
        const isReverted = this.revertedPrompts.has(entry.promptId);
        if (isReverted) {
          const revertedBtn = this.makeActionBtn('Reverted', () => {});
          revertedBtn.disabled = true;
          revertedBtn.style.opacity = '0.4';
          revertedBtn.style.cursor = 'default';
          detailActions.appendChild(revertedBtn);
        } else {
          const revertBtn = this.makeActionBtn('Revert', () => {
            if (this.onRevertCallback) this.onRevertCallback(entry.promptId, entry.changes);
            this.revertedPrompts.add(entry.promptId);
            this.hideDetail();
            this.render();
          });
          detailActions.appendChild(revertBtn);
        }
      }

      const replyBtn = this.makeActionBtn('Reply', () => {
        this.hideDetail();
        const idx = this.filteredEntries.indexOf(entry);
        if (idx >= 0) this.startReply(idx);
      });
      detailActions.appendChild(replyBtn);

      scrollArea.appendChild(detailActions);
    }

    this._detailEl.appendChild(scrollArea);

    // Trigger slide-in animation
    this._detailEl.getBoundingClientRect();
    this._detailEl.style.opacity = '1';
    this._detailEl.style.transform = 'translateX(0)';
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  hideDetail() {
    if (this._detailEl.style.display === 'none') return;

    // Slide detail out to the right
    this._detailEl.style.transition = 'opacity 200ms ease,transform 200ms cubic-bezier(0.4,0,0.2,1)';
    this._detailEl.style.opacity = '0';
    this._detailEl.style.transform = 'translateX(16px)';

    setTimeout(() => {
      this._detailEl.style.display = 'none';

      // Slide list in from the left
      this.listEl.style.display = '';
      this.listEl.style.transform = 'translateX(-16px)';
      this.listEl.style.opacity = '0';
      this.listEl.style.transition = 'opacity 200ms ease,transform 200ms cubic-bezier(0.4,0,0.2,1)';
      this.listEl.getBoundingClientRect();
      this.listEl.style.opacity = '1';
      this.listEl.style.transform = 'translateX(0)';

      this._updateClearBtn();
      if (this.bottomBar.style.display !== 'none') {
        this.bottomBar.style.opacity = '0';
        this.bottomBar.style.transition = 'opacity 200ms ease';
        this.bottomBar.getBoundingClientRect();
        this.bottomBar.style.opacity = '1';
      }
    }, 200);
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
        'font-size:10px;font-weight:700;color:#1a1a1a;font-variant-numeric:tabular-nums;' +
        'font-family:JustifySans,system-ui,sans-serif';
      numSpan.textContent = String(i + 1);
      numCircle.appendChild(numSpan);
      topRow.appendChild(numCircle);

      const summaryEl = document.createElement('div');
      summaryEl.style.cssText = 'flex:1;min-width:0';

      const summaryText = document.createElement('div');
      summaryText.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.85);line-height:1.4';
      summaryText.textContent = entry.summary;
      summaryEl.appendChild(summaryText);

      // Subtitle line: CSS selectors for tweak entries, or the filename(s) for
      // real-diff entries - shown plainly above (like the selectors), not boxed.
      const selectors = [...new Set((entry.changes || []).map(c => c.selector))];
      const diffFiles = [...new Set((entry.diffs || []).map(d => d.file.split('/').pop() || d.file))];
      const subtitle = selectors.length > 0 ? selectors.join(', ')
        : diffFiles.length > 0 ? diffFiles.join(', ') : '';
      if (subtitle) {
        const targets = document.createElement('div');
        targets.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.35);margin-top:3px';
        targets.textContent = subtitle;
        summaryEl.appendChild(targets);
      }

      // Diff stats: +adds -dels. Real added/removed line counts for diff entries;
      // for CSS-tweak entries, the number of property changes.
      let listAdds = 0, listDels = 0;
      if ((entry.diffs || []).length > 0) {
        for (const d of (entry.diffs || [])) {
          for (const h of d.hunks) {
            for (const ln of h.lines) {
              if (ln.t === '+') listAdds++;
              else if (ln.t === '-') listDels++;
            }
          }
        }
      } else {
        listAdds = listDels = (entry.changes || []).length;
      }
      if (listAdds > 0 || listDels > 0) {
        const statsWrap = document.createElement('div');
        statsWrap.style.cssText = 'margin-top:4px';

        const statsSpan = document.createElement('span');
        statsSpan.style.cssText = 'font-size:11px;font-family:JustifyMono,ui-monospace,monospace';

        const addSpan = document.createElement('span');
        addSpan.style.cssText = 'color:#22c55e';
        addSpan.textContent = '+' + listAdds;

        const sepSpan = document.createElement('span');
        sepSpan.style.cssText = 'color:rgba(255,255,255,0.25)';
        sepSpan.textContent = ' ';

        const delSpan = document.createElement('span');
        delSpan.style.cssText = 'color:#ef4444';
        delSpan.textContent = '-' + listDels;

        statsSpan.appendChild(addSpan);
        statsSpan.appendChild(sepSpan);
        statsSpan.appendChild(delSpan);
        statsWrap.appendChild(statsSpan);
        summaryEl.appendChild(statsWrap);
      }

      if ((entry.changes || []).length === 0 && (entry.diffs || []).length === 0 && entry.status === 'completed') {
        // A payload without property diffs is NOT the same as "nothing
        // changed" - if filesChanged is populated, report the files instead
        // of falsely claiming no changes were made.
        const looseFiles = entry.filesChanged || [];
        const noChanges = document.createElement('div');
        if (looseFiles.length > 0) {
          noChanges.style.cssText = 'margin-top:6px;padding:8px 10px;border-radius:8px;font-size:11px;line-height:1.5;' +
            'background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.55)';
          noChanges.textContent = 'Files changed: ' + looseFiles.map(f => f.split('/').pop()).join(', ');
        } else {
          noChanges.style.cssText = 'margin-top:6px;padding:8px 10px;border-radius:8px;font-size:11px;line-height:1.5;' +
            'background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.45);font-style:italic';
          noChanges.textContent = 'No file changes were made.';
        }
        summaryEl.appendChild(noChanges);
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
        actions.style.cssText = 'display:flex;gap:6px;margin-top:8px';

        // Bug fix #5: rename "Done" to "Mark Done"
        const doneBtn = this.makeActionBtn('Mark Done', () => this.markDone(entry.promptId, entry));
        doneBtn.setAttribute('aria-label', 'Mark change as reviewed');
        actions.appendChild(doneBtn);

        if ((entry.changes || []).length > 0 || (entry.diffs || []).length > 0) {
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

        summaryEl.appendChild(actions);
      } else {
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:6px;margin-top:8px';

        const undoBtn = this.makeActionBtn('Undo Done', () => {
          if (this.onUndoDoneCallback) this.onUndoDoneCallback(entry.promptId, entry);
          this.render();
        });
        undoBtn.setAttribute('aria-label', 'Undo mark as reviewed');
        actions.appendChild(undoBtn);

        summaryEl.appendChild(actions);
      }

      // Click anywhere on the item (that isn't a button) opens detail view
      item.addEventListener('click', (e) => {
        // Don't trigger if the click was on a button or input inside the item
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) return;

        this.focusedIndex = i;
        // Issue #1: union per-change selectors with the prompt's target
        // selectors so diff-only results (no per-change selectors) still scroll
        // to + select the element the task was about.
        const changeSelectors = (entry.changes || []).map(c => c.selector).filter(Boolean);
        const selectors = [...new Set([...changeSelectors, ...(entry.targetSelectors || [])])];
        if (this.onSelectCallback) this.onSelectCallback(selectors);

        // Detail must be reachable whenever there is ANYTHING to show -
        // property diffs OR a files-changed list. Gating on changes alone
        // made thin payloads (summary + filesChanged only) unclickable.
        // The panel opens its own detail with the entry it already holds:
        // the old host callback re-filtered the history on changes.length
        // and indexed into THAT list, so thin entries opened nothing and
        // later entries could open the WRONG breakdown (index skew).
        const hasDetail = (entry.changes || []).length > 0 || (entry.filesChanged || []).length > 0;
        if (hasDetail) {
          this.showDetail(entry, i);
        }
      });

      if (i === this.filteredEntries.length - 1) item.style.marginBottom = '0';
      this.listEl.appendChild(item);
    });
    this._updateClearBtn();

    // Bug fix #3: restore scroll position after rebuilding
    this.listEl.scrollTop = savedScrollTop;
  }

  private _updateClearBtn(): void {
    if (!this._clearReviewedBtn || !this.bottomBar) return;
    // "Clear All" is available whenever the panel has any entries - not gated on
    // having marked something done first (the old behavior that hid the button).
    this.bottomBar.style.display = this.filteredEntries.length > 0 ? '' : 'none';
  }

  private makeActionBtn(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText =
      'border:none;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);' +
      'border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;' +
      'font-family:JustifySans,system-ui,sans-serif;transition:background 120ms ease;outline:none';
    btn.addEventListener('mouseenter', () => { btn.style.background = '#D97757'; btn.style.color = '#1a1a1a'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.06)'; btn.style.color = 'rgba(255,255,255,0.6)'; });
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  destroy() {
    this.hide();
    this.container.remove();
  }
}
