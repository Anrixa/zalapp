/**
 * What still stands between a venue and being publishable.
 *
 * Pure and free of Prisma imports on purpose: it is the rule that decides
 * whether a listing goes live, so it should be testable without a database —
 * and a rule nobody can test is a rule that quietly rots.
 *
 * The result is sentences rather than codes because it is shown to the host as
 * a checklist, and every item is something only they can fix.
 */
export interface PublishCandidate {
  images: unknown[];
  prices: { slot: string }[];
  description: string;
  capacityMax: number;
}

const REQUIRED_SLOTS = ['AFTERNOON', 'EVENING'] as const;

/** Enough for a guest to tell one hall from another. */
export const MIN_DESCRIPTION_LENGTH = 40;

export function publishBlockers(venue: PublishCandidate): string[] {
  const blockers: string[] = [];

  if (venue.images.length === 0) blockers.push('add at least one photo');

  const priced = new Set(venue.prices.map((price) => price.slot));
  const missing = REQUIRED_SLOTS.filter((slot) => !priced.has(slot));
  if (missing.length > 0) {
    blockers.push(`set a price for the ${missing.map((slot) => slot.toLowerCase()).join(' and ')}`);
  }

  if (venue.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    blockers.push('write a longer description');
  }

  if (venue.capacityMax <= 0) blockers.push('set the maximum capacity');

  return blockers;
}
