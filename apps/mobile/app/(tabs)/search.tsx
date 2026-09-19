import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useVenueSearch } from '@zal/api-client';
import { VenueType, type VenueSearchQuery } from '@zal/contracts';
import { VenueCard } from '../../src/components/venue-card';
import { Button, EmptyState, ErrorNote, Skeleton } from '../../src/components/ui';
import { colors, fonts, spacing, theme } from '../../src/theme';
import { useT } from '../../src/i18n';

const TYPE_LABELS: Record<string, string> = {
  BANQUET_HALL: 'Banquet hall',
  RESTAURANT: 'Restaurant',
  GARDEN: 'Garden',
  ROOFTOP: 'Rooftop',
  CORPORATE: 'Corporate',
  OUTDOOR: 'Outdoor',
};

export default function SearchScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ types?: string }>();

  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [types, setTypes] = useState<string[]>(params.types ? [params.types] : []);

  const query = useMemo<Partial<VenueSearchQuery>>(
    () => ({
      ...(submitted ? { q: submitted } : {}),
      ...(types.length ? { types: types as VenueSearchQuery['types'] } : {}),
      sort: 'RECOMMENDED',
    }),
    [submitted, types],
  );

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useVenueSearch(query);

  const venues = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <View style={[theme.screen, { paddingTop: insets.top + 12 }]}>
      <View style={[theme.row, theme.section, { gap: 12 }]}>
        <View
          style={[
            theme.row,
            theme.grow,
            {
              gap: 8,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: colors.white,
              borderWidth: 1.5,
              borderColor: colors.line,
            },
          ]}
        >
          <Ionicons name="search-outline" size={16} color={colors.inkMuted} />
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => setSubmitted(text.trim())}
            returnKeyType="search"
            placeholder={t('Search halls, restaurants, cities…')}
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel={t('Search')}
            style={[theme.grow, { paddingVertical: 14, fontFamily: fonts.body, fontSize: 14 }]}
          />
        </View>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={Object.values(VenueType)}
        keyExtractor={(type) => type}
        contentContainerStyle={{ gap: 10, paddingHorizontal: spacing.gutter, paddingVertical: 16 }}
        style={{ flexGrow: 0 }}
        renderItem={({ item: type }) => {
          const active = types.includes(type);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() =>
                setTypes((current) =>
                  active ? current.filter((entry) => entry !== type) : [...current, type],
                )
              }
              style={[theme.chip, active && theme.chipOn]}
            >
              <Text style={[theme.chipText, active && theme.chipTextOn]}>
                {t(TYPE_LABELS[type] ?? type)}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={[theme.spread, theme.section, { paddingBottom: 12 }]}>
        <Text style={theme.muted}>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>{total}</Text>{' '}
          {t('halls available')}
        </Text>
      </View>

      <FlatList
        data={venues}
        keyExtractor={(venue) => venue.id}
        contentContainerStyle={{ gap: 24, paddingHorizontal: spacing.gutter, paddingBottom: 32 }}
        renderItem={({ item }) => <VenueCard venue={item} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListHeaderComponent={error ? <ErrorNote error={error} /> : null}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 24 }}>
              <Skeleton height={300} />
              <Skeleton height={300} />
            </View>
          ) : (
            <EmptyState
              title={t('No halls match that yet')}
              body={t('Try widening the guest count or the price range.')}
              action={
                <Button title={t('Clear all')} variant="secondary" onPress={() => setTypes([])} />
              }
            />
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? <Skeleton height={120} style={{ marginTop: 8 }} /> : null
        }
      />
    </View>
  );
}
