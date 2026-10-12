import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUpcomingAlarms, useToggleAlarm } from '../../hooks/useAlarms';
import { useTheme } from '../../hooks/useTheme';
import { AlarmWithMeeting } from '../../types/alarm';
import { Header } from '../../components/Header';
import { AlarmCard } from '../../components/AlarmCard';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState, AlarmsSkeleton } from '../../components/LoadingState';

export default function AlarmsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: upcomingAlarms = [], isLoading, refetch } = useUpcomingAlarms();
  const toggleAlarm = useToggleAlarm();

  const handleToggle = (alarmId: string, isEnabled: boolean) => {
    const alarmWithMeeting = upcomingAlarms.find((a: AlarmWithMeeting) => a.id === alarmId);
    toggleAlarm.mutate({
      alarmId,
      isEnabled,
      meeting: alarmWithMeeting?.meeting,
      offsetMinutes: alarmWithMeeting?.offsetMinutes,
    });
  };

  const handleTestNotification = () => {
    Alert.alert(
      '⏰ Test Alarm Triggered',
      'Team Sync is starting now\nGoogle Meet • 10:00 AM – 11:00 AM',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <Header
        title="Active Alarms"
        subtitle={`${upcomingAlarms.length} upcoming reminder(s)`}
        rightAction={
          <TouchableOpacity
            onPress={handleTestNotification}
            style={[
              styles.testBtn,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.surfaceBorder,
              },
            ]}
          >
            <Ionicons name="flame" size={14} color={colors.primary} />
            <Text style={[styles.testBtnText, { color: colors.primary }]}>
              Test Alarm
            </Text>
          </TouchableOpacity>
        }
      />

      {isLoading && upcomingAlarms.length === 0 ? (
        <AlarmsSkeleton />
      ) : (
        <FlatList
          data={upcomingAlarms}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item }) => (
            <AlarmCard
              alarmWithMeeting={item}
              onToggle={handleToggle}
              onPressMeeting={(id) => router.push(`/meeting/${id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title="No upcoming alarms"
              description="Configure alarms for any meeting to receive timely alerts on your device."
              actionLabel="View Today's Meetings"
              onAction={() => router.push('/(tabs)/dashboard')}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={[
            styles.listContainer,
            upcomingAlarms.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
