/** Initials for the avatar circles: "Marine Kirakosyan" → "MK". */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((part) => [...part][0]?.toUpperCase() ?? '').join('') || '?';
}

/** "Dvin Hall" → "dvin-hall". Handles Armenian letters by transliteration-free slugging. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}
