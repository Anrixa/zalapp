import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useToggleFavorite, useVenue, useVenueReviews } from '@zal/api-client';
import { venueTypeTone } from '@zal/tokens';
import { Avatar, Button, EmptyState, Loading, Money } from '../../src/components/ui';
import { colors, fonts, placeholderColor, radii, spacing, theme } from '../../src/theme';
import { useT } from '../../src/i18n';

const TYPE_LABEL: Record<string, string> = {
  BANQUET_HALL: 'Banquet hall',
  RESTAURANT: 'Restaurant',
  GARDEN: 'Garden',
  ROOFTOP: 'Rooftop',
  CORPORATE: 'Corporate',
  OUTDOOR: 'Outdoor',
};

export default function VenueDetailScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const { data: venue, isLoading } = useVenue(slug);
  const { data: reviewPages } = useVenueReviews(venue?.id, { limit: 3 });
  const toggleFavorite = useToggleFavorite();

  if (isLoading) return <Loading label="Loading venue" />;

  if (!venue) {
    return (
      <View style={theme.screen}>
        <EmptyState
          title={t('We could not find that venue')}
          body={t('It may have been taken down. Try searching for something similar.')}
          action={<Button title={t('Search')} onPress={() => router.replace('/(tabs)/search')} />}
        />
      </View>
    );
  }

  const tone = venueTypeTone[venue.type];
  const reviews = reviewPages?.pages.flatMap((page) => page.items) ?? [];
  const eveningPrice =
    venue.prices.find((price) => price.slot === 'EVENING')?.priceAmd ?? venue.fromPriceAmd;

  return (
    <View style={theme.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ height: 320 }}>
          {venue.images[0] ? (
            <Image
              source={{ uri: venue.images[0].url }}
              style={{ width: '100%', height: 320 }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: placeholderColor(venue.id) }} />
          )}

          <View
            style={[
              theme.spread,
              {
                position: 'absolute',
                top: insets.top + 8,
                left: spacing.gutter,
                right: spacing.gutter,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={[theme.iconButton, { backgroundColor: 'rgba(36,26,24,0.45)' }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.ivory} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: venue.isSaved }}
              accessibilityLabel={venue.isSaved ? 'Remove from saved' : 'Save this venue'}
              onPress={() => toggleFavorite.mutate(venue.id)}
              style={[theme.iconButton, { backgroundColor: 'rgba(36,26,24,0.45)' }]}
            >
              <Ionicons
                name={venue.isSaved ? 'heart' : 'heart-outline'}
                size={19}
                color={venue.isSaved ? colors.apricot : colors.ivory}
              />
            </Pressable>
          </View>
        </View>

        <View style={[theme.section, { paddingTop: 22 }]}>
          <View style={[theme.spread, { alignItems: 'flex-start' }]}>
            <View>
              <View style={[theme.badge, { backgroundColor: tone.bg }]}>
                <Text style={[theme.badgeText, { color: tone.fg }]}>
                  {t(TYPE_LABEL[venue.type] ?? venue.type).toUpperCase()}
                </Text>
              </View>
              <Text style={[theme.h1, { fontSize: 25, marginTop: 10 }]}>{venue.name}</Text>
            </View>

            {venue.ratingAvg !== null ? (
              <View style={[theme.row, { gap: 4, paddingTop: 4 }]}>
                <Ionicons name="star" size={16} color={colors.apricot} />
                <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 15 }}>
                  {venue.ratingAvg.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[theme.row, { gap: 6, marginTop: 8 }]}>
            <Ionicons name="location-outline" size={14} color={colors.inkSoft} />
            <Text style={theme.muted}>
              {venue.address.line1}, {venue.address.district}, {venue.address.city}
            </Text>
          </View>

          <View
            style={[
              theme.row,
              {
                gap: 20,
                marginTop: 18,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: colors.cardLine,
              },
            ]}
          >
            <Stat label={t('CAPACITY')} value={`${t('up to')} ${venue.capacityMax}`} />
            {venue.areaSqm ? <Stat label={t('SIZE')} value={`${venue.areaSqm} m²`} /> : null}
            {venue.parkingSpots ? (
              <Stat label={t('PARKING')} value={`${venue.parkingSpots} ${t('spots')}`} />
            ) : null}
          </View>
        </View>

        <View style={[theme.row, theme.section, { gap: 12, paddingTop: 24 }]}>
          <Avatar name={venue.host.displayName} size={52} />
          <View style={theme.grow}>
            <Text style={{ fontFamily: fonts.body, fontWeight: '700', fontSize: 14.5 }}>
              {t('Hosted by')} {venue.host.displayName}
            </Text>
            <Text style={[theme.muted, { fontSize: 12.5 }]}>
              {venue.host.respondsWithinMinutes ? `${t('Responds within an hour')} · ` : ''}
              {new Date().getFullYear() - venue.host.memberSince} {t('years on Zal')}
            </Text>
          </View>
        </View>

        <View style={[theme.section, { paddingTop: 24 }]}>
          <Text style={theme.h2}>{t('About this hall')}</Text>
          <Text style={[theme.body, { marginTop: 12, lineHeight: 24, color: colors.inkBody }]}>
            {venue.description}
          </Text>
        </View>

        {venue.amenities.length > 0 ? (
          <View style={[theme.section, { paddingTop: 24 }]}>
            <Text style={theme.h2}>{t('Amenities')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              {venue.amenities.map((amenity) => (
                <View
                  key={amenity.code}
                  style={[
                    theme.row,
                    {
                      gap: 10,
                      padding: 12,
                      borderRadius: radii.input,
                      backgroundColor: colors.white,
                      borderWidth: 1,
                      borderColor: colors.cardLine,
                      width: '47%',
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.pomegranate} />
                  <Text style={[theme.body, theme.grow, { fontSize: 13 }]} numberOfLines={2}>
                    {t(amenity.label)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[theme.section, { paddingTop: 24 }]}>
          <Text style={theme.h2}>{t('Reviews')}</Text>

          {venue.reviewCount === 0 ? (
            <Text style={[theme.muted, { marginTop: 8 }]}>
              {t('No reviews yet — this hall is waiting for its first celebration.')}
            </Text>
          ) : (
            <>
              <View style={[theme.row, { gap: 16, marginTop: 10 }]}>
                <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.ink }}>
                  {venue.ratingAvg?.toFixed(1)}
                </Text>
                <View style={theme.grow}>
                  <View style={[theme.row, { gap: 2 }]}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= Math.round(venue.ratingAvg ?? 0) ? 'star' : 'star-outline'}
                        size={14}
                        color={colors.apricot}
                      />
                    ))}
                  </View>
                  <Text style={[theme.muted, { fontSize: 12.5, marginTop: 6 }]}>
                    {venue.reviewCount} {t('reviews · from real bookings')}
                  </Text>
                </View>
              </View>

              {reviews.map((review) => (
                <View key={review.id} style={[theme.card, { marginTop: 16, padding: 16 }]}>
                  <View style={[theme.row, { gap: 10 }]}>
                    <Avatar name={review.author.displayName} size={36} />
                    <View style={theme.grow}>
                      <Text style={{ fontFamily: fonts.body, fontWeight: '700', fontSize: 13.5 }}>
                        {review.author.displayName}
                      </Text>
                      <Text
                        style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.inkMuted }}
                      >
                        {review.eventMonth}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 13 }}>
                      {review.rating.toFixed(1)}
                    </Text>
                  </View>
                  {review.body ? (
                    <Text style={[theme.body, { fontSize: 13.5, marginTop: 10, lineHeight: 21 }]}>
                      {review.body}
                    </Text>
                  ) : null}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <View style={[theme.stickyBar, { paddingBottom: insets.bottom + 16 }]}>
        <View>
          <Money amountAmd={eveningPrice} style={{ fontFamily: fonts.display, fontSize: 19 }} />
          <Text style={[theme.muted, { fontSize: 12 }]}>{t('per event · deposit 20%')}</Text>
        </View>
        <Button
          title={t('Check availability')}
          onPress={() => router.push(`/book/${venue.id}`)}
          style={theme.grow}
        />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={[theme.eyebrow, { fontSize: 11 }]}>{label}</Text>
      <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 15, marginTop: 3 }}>
        {value}
      </Text>
    </View>
  );
}
