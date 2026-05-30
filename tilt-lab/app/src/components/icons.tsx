import type { ReactNode, SVGProps } from 'react';

/**
 * Icon set sourced from Lucide (https://lucide.dev), ISC licensed.
 * Path data is copied verbatim from the Lucide source - do not redraw,
 * simplify, or approximate. One library per project (Lucide).
 */

type IconProps = SVGProps<SVGSVGElement>;

function LucideIcon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

// lucide: chevron-up
export function ChevronUpIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="m18 15-6-6-6 6" />
    </LucideIcon>
  );
}

// lucide: chevron-down
export function ChevronDownIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </LucideIcon>
  );
}

// lucide: chevron-left
export function ChevronLeftIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="m15 18-6-6 6-6" />
    </LucideIcon>
  );
}

// lucide: chevron-right
export function ChevronRightIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="m9 18 6-6-6-6" />
    </LucideIcon>
  );
}

// lucide: maximize
export function MaximizeIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </LucideIcon>
  );
}

// lucide: minimize
export function MinimizeIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </LucideIcon>
  );
}

// lucide: trash-2
export function TrashIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </LucideIcon>
  );
}

// lucide: x
export function XIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </LucideIcon>
  );
}

// lucide: plus
export function PlusIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </LucideIcon>
  );
}

// lucide: download
export function DownloadIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M12 15V3" />
      <path d="m7 10 5 5 5-5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </LucideIcon>
  );
}

// lucide: copy
export function CopyIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </LucideIcon>
  );
}

// lucide: grip-vertical
export function GripVerticalIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="19" r="1" />
    </LucideIcon>
  );
}

// lucide: check (confirmation feedback, e.g. "copied")
export function CheckIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </LucideIcon>
  );
}

// lucide: eye (channel visible / enabled)
export function EyeIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </LucideIcon>
  );
}

// lucide: eye-off (channel hidden / disabled)
export function EyeOffIcon(props: IconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </LucideIcon>
  );
}
