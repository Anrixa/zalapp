import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useToggleFavorite } from '@zal/api-client';
import type { VenueSummary } from '@zal/contracts';
import { venueTypeTone } from '@zal/tokens';
import { colors, fonts, placeholderColor, radii, shadow, theme } from '../theme';
import { useT } from '../i18n';

const TYPE_LABEL: Record<VenueSummary['type'], string> = {
  BANQUET_HALL: 'Banquet hall',
  RESTAURANT: 'Restaurant',
  GARDEN: 'Garden',
  ROOFTOP: 'Rooftop',
  CORPORATE: 'Corporate',
  OUTDOOR: 'Outdoor',
};

export function VenueCard({ venue, width }: { venue: VenueSummary; width?: number }) {
  const router = useRouter();
  const t = useT();
  const toggleFavorite = useToggleFavorite();
  const tone = venueTypeTone[venue.type];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, ${venue.district}, up to ${venue.capacityMax} guests`}
      onPress={() => router.push(`/venue/${venue.slug}`)}
      style={[theme.card, shadow.card, { padding: 0, overflow: 'hidden', width: width ?? '100%' }]}
    >
      <View>
        {venue.coverImage ? (
          <Image
            source={{ uri: venue.coverImage.url }}
            style={{ height: 168, width: '100%' }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={{ height: 168, backgroundColor: placeholderColor(venue.id) }} />
        )}

        {/*
          The heart sits on the image but is its own button with its own label,
          so a screen reader offers "save" separately from "open the venue"
          rather than burying it inside the card's own action.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: venue.isSaved }}
          accessibilityLabel={
            venue.isSaved ? `Remove ${venue.name} from saved` : `Save ${venue.name}`
          }
          onPress={() => toggleFavorite.mutate(venue.id)}
          hitSlop={8}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 40,
            height: 40,
            borderRadius: radii.pill,
            backgroundColor: 'rgba(36,26,24,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={venue.isSaved ? 'heart' : 'heart-outline'}
            size={19}
            color={venue.isSaved ? colors.apricot : colors.ivory}
          />
        </Pressable>
      </View>

      <View style={{ padding: 16 }}>
        <View style={[theme.spread, { alignItems: 'flex-start' }]}>
          <View style={[theme.badge, { backgroundColor: tone.bg }]}>
            <Text style={[theme.badgeText, { color: tone.fg }]}>{t(TYPE_LABEL[venue.type])}</Text>
          </View>

          {venue.ratingAvg !== null ? (
            <View style={[theme.row, { gap: 4 }]}>
              <Ionicons name="star" size={14} color={colors.apricot} />
              <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 14 }}>
                {venue.ratingAvg.toFixed(1)}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[theme.h2, { fontSize: 18, marginTop: 10 }]}>{venue.name}</Text>

        <View style={[theme.row, { gap: 6, marginTop: 6 }]}>
          <Ionicons name="location-outline" size={14} color={colors.inkSoft} />
          <Text style={theme.muted}>{venue.district}</Text>
          <Text style={theme.muted}>·</Text>
          <Ionicons name="people-outline" size={14} color={colors.inkSoft} />
          <Text style={theme.muted}>
            {t('up to')} {venue.capacityMax}
          </Text>
        </View>

        <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 15, marginTop: 12 }}>
          {venue.fromPriceAmd.toLocaleString('en-US')} AMD
          <Text style={{ fontWeight: '500', color: colors.inkSoft, fontSize: 13 }}>
            {' '}
            {t('/ event')}
          </Text>
        </Text>
      </View>
    </Pressable>
  );
}
