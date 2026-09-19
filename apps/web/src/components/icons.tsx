/**
 * Icons.
 *
 * Inline stroke SVG, drawn to match the design's 1.8px line weight and
 * inheriting `currentColor` so a button's colour carries into its icon. Inline
 * rather than an icon font or a sprite: there are two dozen of them, they never
 * change, and this way they cost no request and no flash of a missing glyph.
 *
 * Every icon is `aria-hidden`; the accessible name belongs on the control.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
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

export const ChevronLeft = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
);

export const ChevronRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 18l6-6-6-6" />
  </Icon>
);

export const ChevronDown = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.3" y2="16.3" />
  </Icon>
);

export const HeartIcon = ({ filled = false, ...props }: IconProps & { filled?: boolean }) => (
  <Icon {...props} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.2s-7.7-4.6-9.9-9.4C.6 7.6 2.2 4.4 5.4 3.7c2-.4 3.9.4 5 2.1a.7.7 0 0 0 1.2 0c1.1-1.7 3-2.5 5-2.1 3.2.7 4.8 3.9 3.3 7.1-2.2 4.8-9.9 9.4-9.9 9.4Z" />
  </Icon>
);

export const BellIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 9a6 6 0 1 1 12 0c0 3 1 4.5 1.7 5.4a1 1 0 0 1-.8 1.6H5.1a1 1 0 0 1-.8-1.6C5 13.5 6 12 6 9Z" />
    <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
  </Icon>
);

export const UserIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
);

export const HallIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 21V10l8-6 8 6v11" />
    <path d="M9 21v-7h6v7" />
  </Icon>
);

export const StarIcon = ({ filled = true, ...props }: IconProps & { filled?: boolean }) => (
  <Icon {...props} fill={filled ? 'currentColor' : 'none'} strokeWidth={1.2}>
    <path d="M12 2.5 15 9l7 .9-5.1 4.8L18.2 21 12 17.4 5.8 21 7.1 14.7 2 9.9 9 9Z" />
  </Icon>
);

export const PinIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.3" />
  </Icon>
);

export const UsersIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.2A6.5 6.5 0 0 1 21.5 20" />
  </Icon>
);

export const CalendarIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props} strokeWidth={2.4}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 6v6l4 2" />
  </Icon>
);

export const MessageIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20l1-5.3A8.5 8.5 0 1 1 21 11.5Z" />
  </Icon>
);

export const CardIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" />
  </Icon>
);

export const SlidersIcon = (props: IconProps) => (
  <Icon {...props}>
    <line x1="4" y1="7" x2="20" y2="7" />
    <circle cx="9" cy="7" r="2.3" fill="currentColor" stroke="none" />
    <line x1="4" y1="17" x2="20" y2="17" />
    <circle cx="16" cy="17" r="2.3" fill="currentColor" stroke="none" />
  </Icon>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Icon>
);

export const PhotoIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M4 17.5 9 10l4 4.5 3-3.5 4 6.5" />
    <circle cx="8" cy="7.5" r="1.6" />
  </Icon>
);

export const ShareIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <line x1="8.2" y1="10.8" x2="15.8" y2="6.2" />
    <line x1="8.2" y1="13.2" x2="15.8" y2="17.8" />
  </Icon>
);

/** The arch mark: a doorway line, used as the app's logo. */
export function ZalMark({ size = 40, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" {...props}>
      <rect width="96" height="96" rx="22" fill="var(--zal-pomegranate)" />
      <path
        d="M26 70V44A22 22 0 0 1 70 44V70"
        stroke="var(--zal-ivory)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="48" cy="60" r="4.5" fill="var(--zal-apricot)" />
    </svg>
  );
}

export const GoogleMark = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.8c-.3 1.4-1 2.6-2.2 3.4v2.8h3.6c2.1-1.9 3.3-4.8 3.3-8.2Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.7 0 5-.9 6.6-2.5l-3.6-2.8c-1 .7-2.2 1.1-3 1.1-2.9 0-5.4-2-6.3-4.6H2.2v2.9C4 20.5 7.7 23 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.7 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7H2.2A11 11 0 0 0 1 12c0 1.8.4 3.5 1.2 5l3.5-2.8Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.4c1.5 0 2.8.5 3.9 1.5l3.2-3.1C17 2 14.7 1 12 1 7.7 1 4 3.5 2.2 7l3.5 2.8c.9-2.6 3.4-4.4 6.3-4.4Z"
    />
  </svg>
);
