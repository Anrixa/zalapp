import { SLOT_HOURS, type TimeSlot } from '@zal/contracts';

/** "Sat, Sep 26" — the short form the booking screens use. */
export function formatShortDate(isoDate: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** "Saturday, September 26, 2026" — for confirmations, where clarity wins. */
export function formatLongDate(isoDate: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function slotLabel(slot: TimeSlot): string {
  return slot === 'AFTERNOON' ? 'Afternoon' : 'Evening';
}

export function slotHours(slot: TimeSlot): string {
  const hours = SLOT_HOURS[slot];
  return `${hours.start} – ${hours.end}`;
}

/** "2 hours ago", "Yesterday" — relative time for the Alerts list. */
export function formatRelative(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (seconds < 86_400) {
    const hours = Math.round(seconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (seconds < 172_800) return 'Yesterday';

  const days = Math.round(seconds / 86_400);
  if (days < 30) return `${days} days ago`;

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(then);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => [...part][0]?.toUpperCase() ?? '').join('') || '?';
}

/** A stable gradient per venue, standing in for a photo that has not loaded. */
export function placeholderGradient(seed: string): string {
  const palettes = [
    ['#C7495A', '#7E1D2B'],
    ['#F0AE5E', '#B9701E'],
    ['#93A98D', '#54683F'],
    ['#4A3B37', '#241A18'],
  ];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const palette = palettes[hash % palettes.length]!;
  return `linear-gradient(160deg, ${palette[0]}, ${palette[1]})`;
}
