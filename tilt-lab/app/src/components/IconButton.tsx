import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import type { TooltipPlacement } from './Tooltip';
import './IconButton.css';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required accessible name - icon-only buttons must have one. */
  label: string;
  /** The icon element to render (e.g. <ChevronUpIcon />). */
  icon: ReactNode;
  /** Where the styled tooltip sits relative to the button. Default: bottom. */
  tooltipPlacement?: TooltipPlacement;
}

export function IconButton({
  label,
  icon,
  className,
  type = 'button',
  tooltipPlacement,
  ...rest
}: IconButtonProps) {
  // The styled Tooltip replaces the native `title`; aria-label remains the
  // accessible name, and the tooltip is aria-hidden to avoid a doubled SR read.
  return (
    <Tooltip label={label} placement={tooltipPlacement}>
      <button
        type={type}
        aria-label={label}
        className={className ? `icon-button ${className}` : 'icon-button'}
        {...rest}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
