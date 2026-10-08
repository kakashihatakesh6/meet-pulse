import React from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { MeetingWithAlarms } from '../types/meeting';
import { MeetingCard } from './MeetingCard';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { useTheme } from '../hooks/useTheme';

export interface MeetingListProps {
  meetings: MeetingWithAlarms[];
  isLoading: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onAlarmPress?: (meeting: MeetingWithAlarms) => void;
  ListHeaderComponent?: React.ReactElement | null;
}

export const MeetingList: React.FC<MeetingListProps> = ({
  meetings,
  isLoading,
  isRefreshing = false,
  onRefresh,
  emptyTitle = 'No meetings found',
  emptyDescription = 'You have no scheduled meetings for this selection.',
  emptyActionLabel,
  onEmptyAction,
  onAlarmPress,
  ListHeaderComponent,
}) => {
  const { colors } = useTheme();

  if (isLoading && meetings.length === 0) {
    return (
      <View style={styles.container}>
        {ListHeaderComponent}
        <LoadingState count={4} />
      </View>
    );
  }

  return (
    <FlatList
      data={meetings}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      renderItem={({ item }) => (
        <MeetingCard meeting={item} onAlarmPress={onAlarmPress} />
      )}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
          icon="calendar-outline"
        />
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
      contentContainerStyle={[
        styles.contentContainer,
        meetings.length === 0 && styles.emptyContainer,
      ]}
      showsVerticalScrollIndicator={false}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
