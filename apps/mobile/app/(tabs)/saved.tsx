import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFavorites } from '@zal/api-client';
import { VenueCard } from '../../src/components/venue-card';
import { Button, EmptyState, ErrorNote, Skeleton } from '../../src/components/ui';
import { spacing, theme } from '../../src/theme';
import { useT } from '../../src/i18n';

export default function SavedScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, error, refetch, isRefetching, fetchNextPage, hasNextPage } =
    useFavorites();

  const favorites = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <View style={[theme.screen, { paddingTop: insets.top + 12 }]}>
      <View style={theme.section}>
        <Text style={theme.muted}>
          {favorites.length} {favorites.length === 1 ? t('hall saved') : t('halls saved')}
        </Text>
        <Text style={theme.h1}>{t('Your shortlist')}</Text>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(favorite) => favorite.venue.id}
        contentContainerStyle={{
          gap: 24,
          paddingHorizontal: spacing.gutter,
          paddingTop: 20,
          paddingBottom: 32,
        }}
        renderItem={({ item }) => <VenueCard venue={item.venue} />}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        onEndReached={() => {
          if (hasNextPage) void fetchNextPage();
        }}
        ListHeaderComponent={error ? <ErrorNote error={error} /> : null}
        ListEmptyComponent={
          isLoading ? (
            <Skeleton height={300} />
          ) : (
            <EmptyState
              title={t('Nothing saved yet')}
              body={t('Tap the heart on a hall you like and it will wait for you here.')}
              action={<Button title={t('Search')} onPress={() => router.push('/(tabs)/search')} />}
            />
          )
        }
      />
    </View>
  );
}
