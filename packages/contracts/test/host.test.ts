import { describe, expect, it } from 'vitest';
import { reorderVenuePhotosSchema, setVenueAddOnsSchema } from '../src/host';

/**
 * These two schemas guard against the same shape of mistake: a list that looks
 * the right size but names the same thing twice. Both used to be caught only by
 * whatever the database happened to do with the second write, which in one case
 * was "leave a photo at its old position" and in the other "create a duplicate
 * extra" — neither of which surfaces as an error the host can see.
 */

const addOn = {
  code: 'PHOTOGRAPHY',
  name: 'Photographer',
  description: null,
  priceAmd: 60_000,
  mandatory: false,
};

describe('reorderVenuePhotosSchema', () => {
  it('accepts a list of distinct ids', () => {
    const result = reorderVenuePhotosSchema.safeParse({
      ids: ['photo-aaa1', 'photo-bbb2', 'photo-ccc3'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a list that names the same photo twice', () => {
    // Length still matches a three-photo venue, and both ids are real, so
    // nothing downstream would have noticed: photo-ccc3 would keep its old position.
    const result = reorderVenuePhotosSchema.safeParse({
      ids: ['photo-aaa1', 'photo-aaa1', 'photo-bbb2'],
    });
    expect(result.success).toBe(false);
  });
});

describe('setVenueAddOnsSchema', () => {
  it('accepts distinct extras', () => {
    const result = setVenueAddOnsSchema.safeParse({
      addOns: [addOn, { ...addOn, code: 'SOUND', name: 'Sound system' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects two extras sharing a code', () => {
    const result = setVenueAddOnsSchema.safeParse({
      addOns: [addOn, { ...addOn, name: 'Second photographer' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects the same extra listed twice by id', () => {
    const result = setVenueAddOnsSchema.safeParse({
      addOns: [
        { ...addOn, id: 'addon-ck01' },
        { ...addOn, id: 'addon-ck01', code: 'SOUND', name: 'Sound system' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('allows an empty list — that is how a host removes every extra', () => {
    expect(setVenueAddOnsSchema.safeParse({ addOns: [] }).success).toBe(true);
  });
});
