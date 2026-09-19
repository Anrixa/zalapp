import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAvailability, useVenue } from '@zal/api-client';
import { SLOT_HOURS, TimeSlot, type DayAvailability } from '@zal/contracts';
import { Button, Money, ScreenHeader, Skeleton } from '../../../src/components/ui';
import { colors, fonts, radii, theme } from '../../../src/theme';
import { useLocale, useT } from '../../../src/i18n';

/**
 * Step 1 of 3 — date, slot and guest count.
 *
 * Nothing is written here. The screen assembles a selection and carries it to
 * Checkout as route params, so backing out and returning does not lose it.
 */
export default function BookingDateScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { intlLocale } = useLocale();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();

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
  const canContinue = Boolean(selectedDate) && slotState?.status === 'OPEN';

  return (
    <View style={[theme.screen, { paddingTop: insets.top + 8 }]}>
      <ScreenHeader title={t('Date & time')} step={t('STEP 1 OF 3')} />

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[theme.section, { paddingTop: 20 }]}>
          <View style={theme.spread}>
            <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 15 }}>{label}</Text>
            <View style={[theme.row, { gap: 8 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Previous month')}
                disabled={monthOffset === 0}
                onPress={() => setMonthOffset((offset) => Math.max(0, offset - 1))}
                style={[
                  theme.iconButton,
                  { width: 36, height: 36, opacity: monthOffset === 0 ? 0.4 : 1 },
                ]}
              >
                <Ionicons name="chevron-back" size={15} color={colors.ink} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Next month')}
                onPress={() => setMonthOffset((offset) => Math.min(11, offset + 1))}
                style={[theme.iconButton, { width: 36, height: 36 }]}
              >
                <Ionicons name="chevron-forward" size={15} color={colors.ink} />
              </Pressable>
            </View>
          </View>

          {isLoading ? (
            <Skeleton height={280} style={{ marginTop: 16 }} />
          ) : (
            <Calendar
              firstDay={firstDay}
              lastDay={lastDay}
              byDate={byDate}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
          )}

          <View style={[theme.row, { gap: 16, marginTop: 14 }]}>
            <Legend color={colors.pomegranate} label={t('Selected')} />
            <Legend color={colors.lineStrong} label={t('Booked')} />
          </View>
        </View>

        <View style={[theme.section, { paddingTop: 26 }]}>
          <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 14.5 }}>
            {t('Time slot')}
          </Text>

          <View style={[theme.row, { gap: 10, marginTop: 12 }]}>
            {[TimeSlot.AFTERNOON, TimeSlot.EVENING].map((option) => {
              const state = selectedDay?.slots.find((entry) => entry.slot === option);
              const disabled = Boolean(selectedDay) && state?.status !== 'OPEN';
              const active = slot === option;

              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled }}
                  disabled={disabled}
                  onPress={() => setSlot(option)}
                  style={[
                    theme.grow,
                    {
                      padding: 14,
                      borderRadius: radii.input,
                      borderWidth: 1.5,
                      borderColor: active ? colors.ink : colors.line,
                      backgroundColor: active ? colors.ink : colors.white,
                      opacity: disabled ? 0.45 : 1,
                      minHeight: 64,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 13.5,
                      fontWeight: '700',
                      color: active ? colors.ivory : colors.ink,
                    }}
                  >
                    {t(option === TimeSlot.AFTERNOON ? 'Afternoon' : 'Evening')}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 11.5,
                      marginTop: 2,
                      color: active ? '#C9BDB3' : colors.inkMuted,
                    }}
                  >
                    {SLOT_HOURS[option].start} – {SLOT_HOURS[option].end}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[theme.section, { paddingTop: 26 }]}>
          <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 14.5 }}>
            {t('Guests')}
          </Text>

          <View
            style={[
              theme.spread,
              {
                marginTop: 12,
                paddingHorizontal: 18,
                paddingVertical: 14,
                borderRadius: radii.input,
                borderWidth: 1.5,
                borderColor: colors.line,
                backgroundColor: colors.white,
              },
            ]}
          >
            <View>
              <Text style={{ fontFamily: fonts.body, fontWeight: '700', fontSize: 14 }}>
                {t('Expected guests')}
              </Text>
              <Text style={[theme.muted, { fontSize: 12 }]}>
                {t('Hall fits up to')} {capacity}
              </Text>
            </View>

            <View style={[theme.row, { gap: 16 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Fewer guests')}
                onPress={() => setGuests((count) => Math.max(10, count - 10))}
                style={[theme.iconButton, { width: 36, height: 36 }]}
              >
                <Ionicons name="remove" size={18} color={colors.ink} />
              </Pressable>

              <Text
                accessibilityLabel={`${guests} guests`}
                style={{
                  fontFamily: fonts.body,
                  fontWeight: '800',
                  fontSize: 16,
                  minWidth: 40,
                  textAlign: 'center',
                }}
              >
                {guests}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('More guests')}
                onPress={() => setGuests((count) => Math.min(capacity, count + 10))}
                style={[theme.iconButton, { width: 36, height: 36, backgroundColor: colors.ink }]}
              >
                <Ionicons name="add" size={18} color={colors.ivory} />
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[theme.stickyBar, { paddingBottom: insets.bottom + 16 }]}>
        <View>
          <Money amountAmd={price} style={{ fontFamily: fonts.display, fontSize: 17 }} />
          <Text style={[theme.muted, { fontSize: 12 }]}>
            {selectedDate
              ? `${selectedDate} · ${guests} ${t('guests')}`
              : t('Pick a date to continue')}
          </Text>
        </View>

        <Button
          title={t('Continue')}
          disabled={!canContinue}
          style={theme.grow}
          onPress={() =>
            router.push({
              pathname: '/book/[venueId]/checkout',
              params: { venueId, date: selectedDate ?? '', slot, guests: String(guests) },
            })
          }
        />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={[theme.row, { gap: 6 }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={[theme.muted, { fontSize: 12 }]}>{label}</Text>
    </View>
  );
}

function Calendar({
  firstDay,
  lastDay,
  byDate,
  selectedDate,
  onSelect,
}: {
  firstDay: string;
  lastDay: string;
  byDate: Map<string, DayAvailability>;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const start = new Date(`${firstDay}T00:00:00Z`);
  const leadingBlanks = start.getUTCDay();
  const dayCount = new Date(`${lastDay}T00:00:00Z`).getUTCDate();
  const today = new Date().toISOString().slice(0, 10);

  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from(
      { length: dayCount },
      (_, index) => `${firstDay.slice(0, 8)}${String(index + 1).padStart(2, '0')}`,
    ),
  ];

  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <Text
            key={`${day}-${index}`}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: fonts.body,
              fontSize: 11,
              fontWeight: '700',
              color: colors.inkMuted,
              paddingBottom: 6,
            }}
          >
            {day}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((date, index) => {
          if (!date)
            return <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, height: 46 }} />;

          const day = byDate.get(date);
          const open = day?.slots.some((entry) => entry.status === 'OPEN') ?? false;
          const past = date < today;
          const selected = date === selectedDate;
          const usable = open && !past;

          return (
            <View key={date} style={{ width: `${100 / 7}%`, height: 46, alignItems: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !usable }}
                accessibilityLabel={`${date}${usable ? '' : ', unavailable'}`}
                disabled={!usable}
                onPress={() => onSelect(date)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? colors.pomegranate : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 13.5,
                    fontWeight: selected ? '800' : '600',
                    color: selected ? colors.ivory : usable ? colors.ink : colors.lineStrong,
                    textDecorationLine: !open && !past ? 'line-through' : 'none',
                  }}
                >
                  {Number(date.slice(8))}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function monthRange(offset: number, intlLocale: string) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const lastDate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));

  return {
    firstDay: base.toISOString().slice(0, 10),
    lastDay: lastDate.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat(intlLocale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(base),
  };
}
