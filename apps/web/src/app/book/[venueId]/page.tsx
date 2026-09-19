'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAvailability, useVenue } from '@zal/api-client';
import { TimeSlot, formatAmdPlain, type DayAvailability } from '@zal/contracts';
import { ScreenHeader, Button, Spinner } from '@/components/ui';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { formatShortDate, slotHours, slotLabel } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';

/**
 * Step 1 of 3 — date, time slot and guest count.
 *
 * The calendar is driven by the real availability endpoint, so a date the
 * server considers taken cannot be selected here. Nothing is written yet: this
 * screen only assembles a selection and carries it to Checkout in the URL,
 * which means a refresh or a back-navigation does not lose it.
 */
export default function BookingDatePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;
  const router = useRouter();
  const t = useT();
  const { intlLocale } = useLocale();

  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlot>(TimeSlot.EVENING);
  const [guests, setGuests] = useState(100);

  const { data: venue } = useVenue(venueId);

  const { firstDay, lastDay, label } = useMemo(
    () => monthRange(monthOffset, intlLocale),
    [monthOffset, intlLocale],
  );

  const { data: availability, isLoading } = useAvailability(venueId, firstDay, lastDay);

  const byDate = useMemo(() => {
    const map = new Map<string, DayAvailability>();
    for (const day of availability?.days ?? []) map.set(day.date, day);
    return map;
  }, [availability]);

  const selectedDay = selectedDate ? byDate.get(selectedDate) : undefined;
  const slotState = selectedDay?.slots.find((entry) => entry.slot === slot);
  const price = slotState?.priceAmd ?? venue?.fromPriceAmd ?? 0;

  const capacity = venue?.capacityMax ?? 500;
  const canContinue = Boolean(selectedDate) && slotState?.status === 'OPEN' && guests > 0;

  return (
    <main className="page">
      <ScreenHeader
        title={t('Date & time')}
        step={t('STEP 1 OF 3')}
        backHref={venue ? `/venues/${venue.slug}` : '/search'}
      />

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="spread">
          <div style={{ fontWeight: 800, fontSize: 15 }}>{label}</div>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="icon-btn"
              style={{ width: 36, height: 36 }}
              onClick={() => setMonthOffset((offset) => Math.max(0, offset - 1))}
              disabled={monthOffset === 0}
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{ width: 36, height: 36 }}
              onClick={() => setMonthOffset((offset) => Math.min(11, offset + 1))}
              aria-label="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <Calendar
          firstDay={firstDay}
          lastDay={lastDay}
          byDate={byDate}
          selectedDate={selectedDate}
          loading={isLoading}
          onSelect={setSelectedDate}
        />

        <div
          className="row"
          style={{ gap: 16, marginTop: 14, fontSize: 12, color: 'var(--zal-ink-soft)' }}
        >
          <Legend color="var(--zal-pomegranate)" label={t('Selected')} />
          <Legend color="var(--zal-line-strong)" label={t('Booked')} />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 26 }}>
        <h2 style={{ fontWeight: 800, fontSize: 14.5, margin: '0 0 12px' }}>
          {selectedDate
            ? `${t('Time slot')} — ${formatShortDate(selectedDate, intlLocale)}`
            : t('Time slot')}
        </h2>

        <div className="row" style={{ gap: 10 }} role="radiogroup" aria-label={t('Time slot')}>
          {[TimeSlot.AFTERNOON, TimeSlot.EVENING].map((option) => {
            const state = selectedDay?.slots.find((entry) => entry.slot === option);
            const disabled = Boolean(selectedDay) && state?.status !== 'OPEN';

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={slot === option}
                disabled={disabled}
                onClick={() => setSlot(option)}
                className="grow"
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: `1.5px solid ${slot === option ? 'var(--zal-ink)' : 'var(--zal-line)'}`,
                  background: slot === option ? 'var(--zal-ink)' : 'var(--zal-white)',
                  color: slot === option ? 'var(--zal-ivory)' : 'var(--zal-ink)',
                  opacity: disabled ? 0.45 : 1,
                  minHeight: 64,
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t(slotLabel(option))}</div>
                <div
                  style={{
                    fontSize: 11.5,
                    marginTop: 2,
                    color: slot === option ? '#C9BDB3' : 'var(--zal-ink-muted)',
                  }}
                >
                  {slotHours(option)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 26 }}>
        <h2 style={{ fontWeight: 800, fontSize: 14.5, margin: '0 0 12px' }}>{t('Guests')}</h2>

        <div
          className="spread"
          style={{
            padding: '14px 18px',
            borderRadius: 14,
            border: '1.5px solid var(--zal-line)',
            background: 'var(--zal-white)',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t('Expected guests')}</div>
            <div style={{ fontSize: 12, color: 'var(--zal-ink-soft)' }}>
              {t('Hall fits up to')} {capacity}
            </div>
          </div>

          <div className="row" style={{ gap: 16 }}>
            <button
              type="button"
              className="icon-btn"
              style={{ width: 36, height: 36 }}
              onClick={() => setGuests((count) => Math.max(1, count - 10))}
              aria-label="Fewer guests"
            >
              −
            </button>

            <label>
              <span className="sr-only">{t('Expected guests')}</span>
              <input
                type="number"
                min={1}
                max={capacity}
                value={guests}
                onChange={(event) =>
                  setGuests(Math.min(capacity, Math.max(1, Number(event.target.value) || 1)))
                }
                style={{
                  width: 56,
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: 16,
                  border: 'none',
                  background: 'transparent',
                }}
              />
            </label>

            <button
              type="button"
              className="icon-btn"
              style={{
                width: 36,
                height: 36,
                background: 'var(--zal-ink)',
                color: 'var(--zal-ivory)',
              }}
              onClick={() => setGuests((count) => Math.min(capacity, count + 10))}
              aria-label="More guests"
            >
              +
            </button>
          </div>
        </div>

        {guests > capacity && (
          <p className="field-error" style={{ marginTop: 8 }}>
            {t('Hall fits up to')} {capacity}
          </p>
        )}
      </section>

      <div className="sticky-bar" style={{ marginTop: 28 }}>
        <div>
          <div className="display" style={{ fontSize: 17 }}>
            {formatAmdPlain(price)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--zal-ink-soft)' }}>
            {selectedDate
              ? `${formatShortDate(selectedDate, intlLocale)} · ${t(slotLabel(slot))} · ${guests} ${t('guests')}`
              : t('Pick a date to continue')}
          </div>
        </div>

        <Button
          className="grow"
          disabled={!canContinue}
          onClick={() =>
            router.push(
              `/book/${venueId}/checkout?date=${selectedDate}&slot=${slot}&guests=${guests}`,
            )
          }
        >
          {t('Continue')}
        </Button>
      </div>
    </main>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: 999, background: color }}
      />
      {label}
    </span>
  );
}

/**
 * The month grid.
 *
 * Days are real `<button>`s so the calendar is keyboard-reachable, and a taken
 * or past date is `disabled` rather than merely greyed — the visual state and
 * the interactive state say the same thing.
 */
function Calendar({
  firstDay,
  lastDay,
  byDate,
  selectedDate,
  loading,
  onSelect,
}: {
  firstDay: string;
  lastDay: string;
  byDate: Map<string, DayAvailability>;
  selectedDate: string | null;
  loading: boolean;
  onSelect: (date: string) => void;
}) {
  const start = new Date(`${firstDay}T00:00:00Z`);
  const end = new Date(`${lastDay}T00:00:00Z`);
  const leadingBlanks = start.getUTCDay();
  const dayCount = end.getUTCDate();
  const today = new Date().toISOString().slice(0, 10);

  if (loading) {
    return <div className="skeleton" style={{ height: 280, marginTop: 16 }} aria-hidden="true" />;
  }

  return (
    <div
      role="grid"
      aria-label="Available dates"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        marginTop: 16,
        textAlign: 'center',
      }}
    >
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
        <div
          key={`${day}-${index}`}
          style={{ fontSize: 11, fontWeight: 700, color: 'var(--zal-ink-muted)', paddingBottom: 6 }}
        >
          {day}
        </div>
      ))}

      {Array.from({ length: leadingBlanks }, (_, index) => (
        <div key={`blank-${index}`} />
      ))}

      {Array.from({ length: dayCount }, (_, index) => {
        const dayNumber = index + 1;
        const date = `${firstDay.slice(0, 8)}${String(dayNumber).padStart(2, '0')}`;
        const day = byDate.get(date);
        const open = day?.slots.some((slot) => slot.status === 'OPEN') ?? false;
        const past = date < today;
        const selected = date === selectedDate;
        const isToday = date === today;

        return (
          <button
            key={date}
            type="button"
            role="gridcell"
            disabled={!open || past}
            aria-selected={selected}
            aria-label={`${date}${open && !past ? '' : ', unavailable'}`}
            onClick={() => onSelect(date)}
            style={{
              width: 44,
              height: 44,
              margin: '0 auto',
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: selected ? 800 : 600,
              background: selected ? 'var(--zal-pomegranate)' : 'transparent',
              color: selected
                ? 'var(--zal-ivory)'
                : open && !past
                  ? 'var(--zal-ink)'
                  : 'var(--zal-line-strong)',
              border: isToday && !selected ? '1.5px solid var(--zal-ink)' : 'none',
              textDecoration: !open && !past ? 'line-through' : 'none',
              cursor: open && !past ? 'pointer' : 'not-allowed',
            }}
          >
            {dayNumber}
          </button>
        );
      })}
    </div>
  );
}

function monthRange(offset: number, intlLocale: string) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const first = base.toISOString().slice(0, 10);
  const lastDate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));

  return {
    firstDay: first,
    lastDay: lastDate.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat(intlLocale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(base),
  };
}
