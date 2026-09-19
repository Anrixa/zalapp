/**
 * Development seed.
 *
 * The data is lifted from the Zal design canvas so the running app looks like
 * the screens it was drawn from: Dvin Hall at 420,000 with a 250 capacity,
 * Marine K. as the host who responds within an hour, Ani Sargsyan as the guest,
 * and the three add-ons the Checkout screen offers. Working against the same
 * numbers the design uses is what makes a mismatch obvious at a glance.
 *
 * Run with `pnpm db:seed`. Idempotent: it upserts by natural key, so running
 * it twice does not duplicate anything.
 */
import { PrismaClient, type AmenityCode, type VenueType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { computeDeadlines, computeQuote, formatBookingRef } from '@zal/contracts';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'zal12345';

interface VenueSeed {
  slug: string;
  name: string;
  type: VenueType;
  description: string;
  addressLine: string;
  district: string;
  lat: number;
  lng: number;
  capacityMax: number;
  capacityMin: number;
  areaSqm: number;
  parkingSpots: number;
  afternoonAmd: number;
  eveningAmd: number;
  weekendEveningAmd: number;
  amenities: AmenityCode[];
  host: 'marine' | 'gevorg';
}

const VENUES: VenueSeed[] = [
  {
    slug: 'dvin-hall',
    name: 'Dvin Hall',
    type: 'BANQUET_HALL',
    description:
      'A grand ballroom in the heart of Kentron with 6-metre ceilings, a private garden entrance and a full-service kitchen. Popular for weddings, engagement parties and large anniversary celebrations. In-house catering and a resident tamada can be arranged on request.',
    addressLine: 'Baghramyan Ave 24',
    district: 'Kentron',
    lat: 40.1889,
    lng: 44.5119,
    capacityMax: 250,
    capacityMin: 80,
    areaSqm: 480,
    parkingSpots: 60,
    afternoonAmd: 320_000,
    eveningAmd: 420_000,
    weekendEveningAmd: 480_000,
    amenities: [
      'PARKING',
      'CATERING',
      'SOUND_DJ',
      'DANCE_FLOOR',
      'AIR_CONDITIONING',
      'PHOTOGRAPHY_ALLOWED',
    ],
    host: 'marine',
  },
  {
    slug: 'zvartnots-garden',
    name: 'Zvartnots Garden',
    type: 'GARDEN',
    description:
      'An open garden with mature walnut trees and a covered pavilion for when the weather turns. Sunset ceremonies here run straight into the evening without moving the guests.',
    addressLine: 'Halabyan St 18',
    district: 'Ajapnyak',
    lat: 40.2043,
    lng: 44.4621,
    capacityMax: 180,
    capacityMin: 40,
    areaSqm: 900,
    parkingSpots: 40,
    afternoonAmd: 260_000,
    eveningAmd: 310_000,
    weekendEveningAmd: 360_000,
    amenities: ['PARKING', 'OUTDOOR_TERRACE', 'CATERING', 'KIDS_AREA', 'PHOTOGRAPHY_ALLOWED'],
    host: 'marine',
  },
  {
    slug: 'ararat-terrace',
    name: 'Ararat Terrace',
    type: 'ROOFTOP',
    description:
      'A rooftop with an unobstructed view of Ararat on a clear day. Glass windbreaks and outdoor heaters keep it usable from April through October.',
    addressLine: 'Erebuni St 5',
    district: 'Erebuni',
    lat: 40.1479,
    lng: 44.5253,
    capacityMax: 120,
    capacityMin: 30,
    areaSqm: 240,
    parkingSpots: 20,
    afternoonAmd: 210_000,
    eveningAmd: 260_000,
    weekendEveningAmd: 300_000,
    amenities: ['OUTDOOR_TERRACE', 'SOUND_DJ', 'AIR_CONDITIONING', 'PHOTOGRAPHY_ALLOWED'],
    host: 'gevorg',
  },
  {
    slug: 'nairi-banquet-house',
    name: 'Nairi Banquet House',
    type: 'BANQUET_HALL',
    description:
      'The largest hall on the list, built for three-hundred-guest weddings, with a separate entrance hall for receiving lines and a kitchen that can plate all of it at once.',
    addressLine: 'Bagratunyats St 42',
    district: 'Shengavit',
    lat: 40.1497,
    lng: 44.4785,
    capacityMax: 300,
    capacityMin: 120,
    areaSqm: 620,
    parkingSpots: 90,
    afternoonAmd: 380_000,
    eveningAmd: 480_000,
    weekendEveningAmd: 540_000,
    amenities: [
      'PARKING',
      'CATERING',
      'SOUND_DJ',
      'DANCE_FLOOR',
      'AIR_CONDITIONING',
      'WHEELCHAIR_ACCESS',
    ],
    host: 'gevorg',
  },
  {
    slug: 'sevan-pearl-hall',
    name: 'Sevan Pearl Hall',
    type: 'BANQUET_HALL',
    description:
      'A recently refurbished hall in Davtashen with a neutral palette that takes decoration well, and a quiet side room for the family before the doors open.',
    addressLine: 'Tsarav Aghbyur St 3',
    district: 'Davtashen',
    lat: 40.2286,
    lng: 44.4789,
    capacityMax: 220,
    capacityMin: 70,
    areaSqm: 410,
    parkingSpots: 50,
    afternoonAmd: 310_000,
    eveningAmd: 390_000,
    weekendEveningAmd: 430_000,
    amenities: ['PARKING', 'CATERING', 'DANCE_FLOOR', 'AIR_CONDITIONING'],
    host: 'marine',
  },
  {
    slug: 'vernissage-hall',
    name: 'Vernissage Hall',
    type: 'RESTAURANT',
    description:
      'A restaurant hall a minute from the Vernissage market, used most often for baptisms and birthdays. The kitchen is the draw — the room seats 180 but the menu is the reason people book it.',
    addressLine: 'Aram St 12',
    district: 'Kentron',
    lat: 40.1795,
    lng: 44.5152,
    capacityMax: 180,
    capacityMin: 40,
    areaSqm: 330,
    parkingSpots: 25,
    afternoonAmd: 280_000,
    eveningAmd: 340_000,
    weekendEveningAmd: 380_000,
    amenities: ['CATERING', 'SOUND_DJ', 'AIR_CONDITIONING', 'KIDS_AREA', 'SMOKING_AREA'],
    host: 'marine',
  },
];

/** The three extras on the Checkout screen, offered by every venue. */
const ADD_ONS = [
  {
    code: 'DJ',
    name: 'Live music & DJ',
    description: 'In-house sound engineer, 4 hours',
    priceAmd: 60_000,
    position: 0,
  },
  {
    code: 'PHOTOGRAPHY',
    name: 'Photography package',
    description: '5-hour coverage, edited gallery',
    priceAmd: 90_000,
    position: 1,
  },
  {
    code: 'FLORAL',
    name: 'Floral & table styling',
    description: 'Centerpieces for 20 tables',
    priceAmd: 120_000,
    position: 2,
  },
];

async function main(): Promise<void> {
  console.log('Seeding Zal…');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── People ──────────────────────────────────────────────────────────────
  const guest = await prisma.user.upsert({
    where: { phone: '+37477123456' },
    create: {
      fullName: 'Ani Sargsyan',
      phone: '+37477123456',
      email: 'ani@example.am',
      passwordHash,
      phoneVerifiedAt: new Date(),
      locale: 'hy',
      notificationPreference: { create: {} },
    },
    update: { passwordHash, phoneVerifiedAt: new Date() },
  });

  const marineUser = await prisma.user.upsert({
    where: { phone: '+37455200100' },
    create: {
      fullName: 'Marine Kirakosyan',
      phone: '+37455200100',
      email: 'marine@example.am',
      passwordHash,
      role: 'HOST',
      phoneVerifiedAt: new Date(),
      notificationPreference: { create: {} },
    },
    update: { role: 'HOST' },
  });

  const gevorgUser = await prisma.user.upsert({
    where: { phone: '+37455200200' },
    create: {
      fullName: 'Gevorg Petrosyan',
      phone: '+37455200200',
      email: 'gevorg@example.am',
      passwordHash,
      role: 'HOST',
      phoneVerifiedAt: new Date(),
      notificationPreference: { create: {} },
    },
    update: { role: 'HOST' },
  });

  const marine = await prisma.hostProfile.upsert({
    where: { userId: marineUser.id },
    create: {
      userId: marineUser.id,
      displayName: 'Marine K.',
      bio: 'Running halls in Yerevan since 2020. Happy to walk you through the room before you decide.',
      respondsWithinMinutes: 60,
      memberSince: 2020,
    },
    update: {},
  });

  const gevorg = await prisma.hostProfile.upsert({
    where: { userId: gevorgUser.id },
    create: {
      userId: gevorgUser.id,
      displayName: 'Gevorg P.',
      bio: 'Two spaces, one rooftop and one large hall. I answer in the evenings.',
      respondsWithinMinutes: 180,
      memberSince: 2022,
    },
    update: {},
  });

  const hosts = { marine, gevorg };

  // ── Venues ──────────────────────────────────────────────────────────────
  for (const seed of VENUES) {
    const venue = await prisma.venue.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        hostProfileId: hosts[seed.host].id,
        name: seed.name,
        type: seed.type,
        // Explicit, because the column now defaults to DRAFT: seeded venues
        // are demo data and are meant to be visible.
        status: 'PUBLISHED',
        description: seed.description,
        addressLine: seed.addressLine,
        district: seed.district,
        city: 'Yerevan',
        lat: seed.lat,
        lng: seed.lng,
        capacityMin: seed.capacityMin,
        capacityMax: seed.capacityMax,
        areaSqm: seed.areaSqm,
        parkingSpots: seed.parkingSpots,
      },
      update: { description: seed.description, status: 'PUBLISHED' },
    });

    await prisma.venuePrice.upsert({
      where: { venueId_slot: { venueId: venue.id, slot: 'AFTERNOON' } },
      create: { venueId: venue.id, slot: 'AFTERNOON', priceAmd: seed.afternoonAmd },
      update: { priceAmd: seed.afternoonAmd },
    });
    await prisma.venuePrice.upsert({
      where: { venueId_slot: { venueId: venue.id, slot: 'EVENING' } },
      create: {
        venueId: venue.id,
        slot: 'EVENING',
        priceAmd: seed.eveningAmd,
        weekendPriceAmd: seed.weekendEveningAmd,
      },
      update: { priceAmd: seed.eveningAmd, weekendPriceAmd: seed.weekendEveningAmd },
    });

    await prisma.venueAmenity.deleteMany({ where: { venueId: venue.id } });
    await prisma.venueAmenity.createMany({
      data: seed.amenities.map((code) => ({ venueId: venue.id, code })),
      skipDuplicates: true,
    });

    for (const addOn of ADD_ONS) {
      await prisma.addOn.upsert({
        where: { venueId_code: { venueId: venue.id, code: addOn.code } },
        create: { venueId: venue.id, ...addOn },
        update: { priceAmd: addOn.priceAmd, description: addOn.description },
      });
    }

    // Placeholder imagery: gradients rendered by the clients rather than
    // hot-linked stock photos nobody has licensed.
    const existingImages = await prisma.venueImage.count({ where: { venueId: venue.id } });
    if (existingImages === 0) {
      await prisma.venueImage.createMany({
        data: Array.from({ length: 4 }, (_, index) => ({
          venueId: venue.id,
          url: `https://placehold.co/1200x800/A32638/FBF6EF/png?text=${encodeURIComponent(seed.name)}`,
          position: index,
          width: 1200,
          height: 800,
        })),
      });
    }

    // A handful of taken dates so the calendar has something to show.
    const today = new Date();
    for (const offset of [5, 12, 19, 26]) {
      const date = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset),
      );
      await prisma.venueAvailability.upsert({
        where: { venueId_date_slot: { venueId: venue.id, date, slot: 'EVENING' } },
        create: { venueId: venue.id, date, slot: 'EVENING', status: 'BOOKED' },
        update: {},
      });
    }
  }

  // ── A booking that matches the Confirmation screen ───────────────────────
  const dvin = await prisma.venue.findUniqueOrThrow({ where: { slug: 'dvin-hall' } });

  // Far enough out that the free-cancellation window is still open, so the
  // Booking detail screen has something to show for every state it renders.
  const eventDate = new Date();
  eventDate.setUTCDate(eventDate.getUTCDate() + 45);
  const eventIso = eventDate.toISOString().slice(0, 10);

  const dj = await prisma.addOn.findUniqueOrThrow({
    where: { venueId_code: { venueId: dvin.id, code: 'DJ' } },
  });

  const quote = computeQuote({
    rentalAmd: 420_000,
    addOns: [{ id: dj.id, name: dj.name, priceAmd: dj.priceAmd }],
    discountAmd: 0,
  });
  const deadlines = computeDeadlines(eventIso);
  const ref = formatBookingRef(eventIso, 7);

  const existingBooking = await prisma.booking.findUnique({ where: { ref } });
  if (!existingBooking) {
    const booking = await prisma.booking.create({
      data: {
        ref,
        venueId: dvin.id,
        userId: guest.id,
        status: 'CONFIRMED',
        eventDate: new Date(`${eventIso}T00:00:00.000Z`),
        slot: 'EVENING',
        guestCount: 180,
        eventType: 'WEDDING',
        rentalAmd: quote.rentalAmd,
        addOnsTotalAmd: quote.addOnsTotalAmd,
        discountAmd: quote.discountAmd,
        subtotalAmd: quote.subtotalAmd,
        serviceFeeAmd: quote.serviceFeeAmd,
        totalAmd: quote.totalAmd,
        depositAmd: quote.depositAmd,
        balanceAmd: quote.balanceAmd,
        paidAmd: quote.depositAmd,
        balanceDueOn: new Date(`${deadlines.balanceDueOn}T00:00:00.000Z`),
        freeCancellationUntil: new Date(`${deadlines.freeCancellationUntil}T00:00:00.000Z`),
        confirmedAt: new Date(),
        addOns: { create: [{ addOnId: dj.id, name: dj.name, priceAmd: dj.priceAmd }] },
        payments: {
          create: [
            {
              kind: 'DEPOSIT',
              provider: 'CARD',
              status: 'SUCCEEDED',
              amountAmd: quote.depositAmd,
              settledAt: new Date(),
              providerRef: 'seed_deposit',
            },
          ],
        },
      },
    });

    await prisma.venueAvailability.upsert({
      where: {
        venueId_date_slot: {
          venueId: dvin.id,
          date: new Date(`${eventIso}T00:00:00.000Z`),
          slot: 'EVENING',
        },
      },
      create: {
        venueId: dvin.id,
        date: new Date(`${eventIso}T00:00:00.000Z`),
        slot: 'EVENING',
        status: 'BOOKED',
        bookingId: booking.id,
      },
      update: { status: 'BOOKED', bookingId: booking.id },
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: guest.id,
          type: 'BOOKING_CONFIRMED',
          title: 'Booking confirmed',
          body: `Marine K. confirmed your booking at Dvin Hall for ${eventIso}.`,
          data: { bookingId: booking.id, venueId: dvin.id },
        },
        {
          userId: guest.id,
          type: 'BALANCE_DUE',
          title: 'Balance due soon',
          body: `Balance of ${quote.balanceAmd.toLocaleString('en-US')} AMD for Dvin Hall is due on ${deadlines.balanceDueOn}.`,
          data: { bookingId: booking.id, amountAmd: quote.balanceAmd },
        },
      ],
    });
  }

  // ── A completed booking with a review, so venues have ratings ────────────
  const past = new Date();
  past.setUTCDate(past.getUTCDate() - 30);
  const pastIso = past.toISOString().slice(0, 10);
  const pastRef = formatBookingRef(pastIso, 1);

  if (!(await prisma.booking.findUnique({ where: { ref: pastRef } }))) {
    const pastQuote = computeQuote({ rentalAmd: 420_000, addOns: [], discountAmd: 0 });
    const pastDeadlines = computeDeadlines(pastIso);

    const completed = await prisma.booking.create({
      data: {
        ref: pastRef,
        venueId: dvin.id,
        userId: guest.id,
        status: 'COMPLETED',
        eventDate: new Date(`${pastIso}T00:00:00.000Z`),
        slot: 'EVENING',
        guestCount: 200,
        eventType: 'WEDDING',
        rentalAmd: pastQuote.rentalAmd,
        subtotalAmd: pastQuote.subtotalAmd,
        serviceFeeAmd: pastQuote.serviceFeeAmd,
        totalAmd: pastQuote.totalAmd,
        depositAmd: pastQuote.depositAmd,
        balanceAmd: pastQuote.balanceAmd,
        paidAmd: pastQuote.totalAmd,
        balanceDueOn: new Date(`${pastDeadlines.balanceDueOn}T00:00:00.000Z`),
        freeCancellationUntil: new Date(`${pastDeadlines.freeCancellationUntil}T00:00:00.000Z`),
        confirmedAt: past,
      },
    });

    await prisma.review.create({
      data: {
        venueId: dvin.id,
        userId: guest.id,
        bookingId: completed.id,
        rating: 5,
        body: 'Stunning hall, the staff handled everything. Our 200 guests had plenty of room and the garden photos came out beautiful.',
      },
    });

    const stats = await prisma.review.aggregate({
      where: { venueId: dvin.id, deletedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.venue.update({
      where: { id: dvin.id },
      data: {
        ratingAvg: stats._avg.rating ? Math.round(stats._avg.rating * 100) / 100 : null,
        reviewCount: stats._count.rating,
      },
    });
  }

  // Ratings for the other venues so search sorting has something to work with.
  const seededRatings: Record<string, { ratingAvg: number; reviewCount: number }> = {
    'zvartnots-garden': { ratingAvg: 4.8, reviewCount: 96 },
    'ararat-terrace': { ratingAvg: 4.7, reviewCount: 58 },
    'nairi-banquet-house': { ratingAvg: 4.9, reviewCount: 143 },
    'sevan-pearl-hall': { ratingAvg: 4.6, reviewCount: 71 },
    'vernissage-hall': { ratingAvg: 4.8, reviewCount: 88 },
  };
  for (const [slug, rating] of Object.entries(seededRatings)) {
    await prisma.venue.update({ where: { slug }, data: rating });
  }

  await prisma.promoCode.upsert({
    where: { code: 'WEEKDAY15' },
    create: {
      code: 'WEEKDAY15',
      label: 'Weekday promo',
      discountAmd: 45_000,
      active: true,
    },
    update: {},
  });

  console.log(`Seeded ${VENUES.length} venues, 2 hosts and 1 guest.`);
  console.log(`Demo guest: +374 77 123 456 / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
