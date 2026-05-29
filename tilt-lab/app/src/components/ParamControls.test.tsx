import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParamControls } from './ParamControls';
import type { ParamSpec } from '../../../runtime/types';

const specs: ParamSpec[] = [
  { name: 'speed', type: 'range', default: 1, min: 0, max: 5, step: 0.5 },
  { name: 'colorA', type: 'color', default: '#ff0000' },
  { name: 'loop', type: 'toggle', default: true },
];

const values = { speed: 1, colorA: '#ff0000', loop: true };

describe('ParamControls', () => {
  it('renders a labelled control per spec', () => {
    render(<ParamControls specs={specs} values={values} onChange={() => {}} />);
    expect(screen.getByLabelText('speed')).toBeTruthy();
    expect(screen.getByLabelText('colorA')).toBeTruthy();
    expect(screen.getByLabelText('loop')).toBeTruthy();
  });

  it('emits onChange with coerced numeric value for a range', () => {
    const onChange = vi.fn();
    render(<ParamControls specs={specs} values={values} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('speed'), { target: { value: '3.5' } });
    expect(onChange).toHaveBeenCalledWith('speed', 3.5);
  });

  it('emits onChange with boolean for a toggle', () => {
    const onChange = vi.fn();
    render(<ParamControls specs={specs} values={values} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('loop'));
    expect(onChange).toHaveBeenCalledWith('loop', false);
  });
});
