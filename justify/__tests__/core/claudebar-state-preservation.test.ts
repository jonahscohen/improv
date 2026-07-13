// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JustifyCore } from '../../core/index.js';

// MOUNTING A NEW PILL IS A REPLACEMENT, NOT A CANCELLATION.
//
// This is a regression guard on the SECOND cause of the frozen Claudebar - and in
// real use, the more common one, because batching is the whole point of the queue.
//
// `_showClaudeBar()` used to begin by calling `_removeClaudeBar(true)` to unmount
// any existing pill. But `_removeClaudeBar` also sets `_claudeState = 'none'` (it
// is the CANCELLATION path - "there is no job, show nothing"). It early-returns
// when no pill exists, which is what hid the bug: a SINGLE prompt has no pill yet
// when it calls _showClaudeBar, so the reset was skipped and the state survived.
//
// A "Send All" of N>1 tasks loops submitFromQueue, and every iteration does:
//
//     this._core._claudeState = 'sending';
//     this._core._showClaudeBar('Sending to Claude', 'writing', true);
//
// From the second iteration on a pill DOES exist, so the teardown ran and wiped
// the 'sending' the caller had just set, back to 'none'. The bar then read
// "Sending to Claude." while its state was 'none', which made it DEAF: both
// `justify_queued` and `justify_working` gate on `_claudeState === 'sending'`, so
// nothing could ever advance it. The batch applied fine and the queue drained; the
// pill sat there lying until a reload.
//
// Measured live 2026-07-12 on an isolated daemon: a 2-task Send All left
// GET /claude-state reporting "none" behind a "Sending to Claude." pill.

// _showClaudeBar paints Shadow-DOM-adjacent chrome and persists over fetch, so we
// exercise it on a prototype-only instance with the collaborators stubbed - the
// same approach toolbar-theme.test.ts uses. The state machine is what is on trial,
// not the paint.
type CoreLike = JustifyCore & Record<string, unknown>;

function coreHarness(): CoreLike {
  const core = Object.create(JustifyCore.prototype) as CoreLike;
  core._claudeState = 'none';
  core._claudePill = null;
  core._claudeSpark = null;
  core._claudeLabel = null;
  core._claudeAnim = null;
  core._spriteSvgs = {};
  core._changeHistory = [];
  core._barTray = document.createElement('div');
  document.body.appendChild(core._barTray as HTMLElement);
  // Collaborators that reach outside the state machine.
  core._loadSprites = () => {};
  core._persistClaudeState = () => {};
  core._addBarPillHover = () => {};
  core._mk = () => '#D97757';
  return core;
}

const labelOf = (core: CoreLike) => (core._claudeLabel as HTMLElement | null)?.textContent ?? null;

describe('the Claudebar keeps its state when a pill is REPLACED', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves _claudeState across a _showClaudeBar that replaces an existing pill', () => {
    const core = coreHarness();

    // First task of a Send All: no pill exists yet.
    core._claudeState = 'sending';
    core._showClaudeBar('Sending to Claude', 'writing', true);
    expect(core._claudeState).toBe('sending');
    expect(core._claudePill).not.toBeNull();

    // SECOND task of the same Send All. A pill now exists, so the teardown runs.
    // Pre-fix this is where 'sending' silently became 'none' and the bar went deaf.
    core._claudeState = 'sending';
    core._showClaudeBar('Sending to Claude', 'writing', true);
    expect(core._claudeState).toBe('sending');
  });

  it('a 5-task Send All still ends in sending, not none', () => {
    const core = coreHarness();
    for (let i = 0; i < 5; i++) {
      core._claudeState = 'sending';
      core._showClaudeBar('Sending to Claude', 'writing', true);
    }
    expect(core._claudeState).toBe('sending');
  });

  it('so a batched send can still be advanced by justify_queued -> justify_working', () => {
    // The end-to-end point of the fix: after an N-task Send All the bar must still
    // be REACHABLE by the events that move it. Both gates require 'sending'.
    const core = coreHarness();
    for (let i = 0; i < 3; i++) {
      core._claudeState = 'sending';
      core._showClaudeBar('Sending to Claude', 'writing', true);
    }

    // The daemon acks the batch as durable.
    expect(core._claudeState).toBe('sending'); // the gate justify_queued checks
    core._claudeToQueued();
    expect(core._claudeState).toBe('queued');
    expect(labelOf(core)).toBe('Queued for Claude');

    // An owner claims it.
    core._claudeToWorking();
    expect(core._claudeState).toBe('working');
    expect(labelOf(core)).toBe('Working');
  });

  it('_removeClaudeBar STILL cancels - it resets the state to none and drops the pill', () => {
    // The cancellation semantic must survive the refactor: callers that mean "there
    // is no job" still get a full reset. Only the internal replace path is exempt.
    const core = coreHarness();
    core._claudeState = 'sending';
    core._showClaudeBar('Sending to Claude', 'writing', true);

    core._removeClaudeBar(true);
    expect(core._claudeState).toBe('none');
    expect(core._claudePill).toBeNull();
  });

  it('_removeClaudeBar on an ALREADY-EMPTY bar does not stomp a state that is in flight', () => {
    // The pre-existing early-out. It is load-bearing: it is the reason the
    // single-prompt path never hit this bug, and removing it would resurrect it.
    const core = coreHarness();
    core._claudeState = 'sending';
    core._claudePill = null;

    core._removeClaudeBar(true);
    expect(core._claudeState).toBe('sending');
  });

  it('replacing a pill kills the old ellipsis timer, so a detached pill cannot keep animating', () => {
    // Splitting the teardown out of _removeClaudeBar must not drop its clearInterval.
    // Asserted by BEHAVIOUR (does the orphaned pill still mutate?) rather than by a
    // global timer count, which also sees the core's own transport/watch timers.
    vi.useFakeTimers();
    const core = coreHarness();
    core._claudeState = 'sending';
    core._showClaudeBar('Sending to Claude', 'writing', true);
    const firstPill = core._claudePill as HTMLElement & { _dotInterval?: unknown };
    const firstLabel = core._claudeLabel as HTMLElement;
    expect(firstPill._dotInterval).toBeTruthy();

    core._claudeState = 'sending';
    core._showClaudeBar('Sending to Claude', 'writing', true);
    expect(firstPill.isConnected).toBe(false); // detached

    // If the orphan's interval were still live it would keep writing dots into this
    // detached label forever. Freeze what it says, run 2s of ticks, and it must not
    // have moved.
    const frozen = firstLabel.textContent;
    vi.advanceTimersByTime(2000);
    expect(firstLabel.textContent).toBe(frozen);
  });
});
