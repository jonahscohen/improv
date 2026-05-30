import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render the label until shown', () => {
    render(
      <Tooltip label="Add shader">
        <button type="button" aria-label="Add shader">
          +
        </button>
      </Tooltip>,
    );
    expect(screen.queryByText('Add shader')).toBeNull();
  });

  it('shows the label immediately on keyboard focus', () => {
    render(
      <Tooltip label="Add shader">
        <button type="button" aria-label="Add shader">
          +
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Add shader' });
    // Arm keyboard modality (a Tab keydown) so focus is treated as focus-visible.
    fireEvent.keyDown(button, { key: 'Tab' });
    fireEvent.focus(button);
    expect(screen.getByText('Add shader')).toBeTruthy();
  });

  it('keeps the button aria-label as the accessible name and hides the tooltip from SR', () => {
    render(
      <Tooltip label="Add shader">
        <button type="button" aria-label="Add shader">
          +
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Add shader' });
    fireEvent.keyDown(button, { key: 'Tab' });
    fireEvent.focus(button);
    expect(screen.getByText('Add shader').getAttribute('aria-hidden')).toBe('true');
  });

  it('shows instantly on hover (no delay) and hides on leave', () => {
    render(
      <Tooltip label="Add shader">
        <button type="button" aria-label="Add shader">
          +
        </button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Add shader' }).parentElement!;
    // The label is in the DOM the instant the pointer enters - no timer to advance.
    fireEvent.mouseEnter(trigger);
    expect(screen.getByText('Add shader')).toBeTruthy();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText('Add shader')).toBeNull();
  });

  it('still honors an explicit delay prop when one is passed', () => {
    vi.useFakeTimers();
    render(
      <Tooltip label="Add shader" delay={400}>
        <button type="button" aria-label="Add shader">
          +
        </button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Add shader' }).parentElement!;
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByText('Add shader')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText('Add shader')).toBeTruthy();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText('Add shader')).toBeNull();
  });

  it('hides on Escape', () => {
    render(
      <Tooltip label="Add shader">
        <button type="button" aria-label="Add shader">
          +
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Add shader' });
    fireEvent.keyDown(button, { key: 'Tab' });
    fireEvent.focus(button);
    expect(screen.getByText('Add shader')).toBeTruthy();
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByText('Add shader')).toBeNull();
  });
});
