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
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationService } from '../../services/notifications/notification.service';
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
  const { isGranted, requestPermissions } = useNotifications();

  const handleToggle = (alarmId: string, isEnabled: boolean) => {
    const alarmWithMeeting = upcomingAlarms.find((a: AlarmWithMeeting) => a.id === alarmId);
    toggleAlarm.mutate({
      alarmId,
      isEnabled,
      meeting: alarmWithMeeting?.meeting,
      offsetMinutes: alarmWithMeeting?.offsetMinutes,
    });
  };

  const handleTestNotification = async () => {
    if (!isGranted) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please grant notification permissions in device settings to receive meeting alarms.'
        );
        return;
      }
    }

    try {
      await NotificationService.sendTestNotification();
      Alert.alert(
        '🔔 Test Alarm Scheduled',
        'You will receive a high-priority meeting notification in 2 seconds with custom sound and vibration.',
        [{ text: 'Got it' }]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to schedule test notification');
    }
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

      {/* Permission Warning Banner if notifications are disabled */}
      {!isGranted ? (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.warning,
            },
          ]}
        >
          <Ionicons
            name="notifications-off-outline"
            size={22}
            color={colors.warning}
          />
          <View style={styles.bannerTextCol}>
            <Text style={[styles.bannerTitle, { color: colors.text }]}>
              Notifications Are Disabled
            </Text>
            <Text style={[styles.bannerDesc, { color: colors.textMuted }]}>
              Enable permissions so you receive 10-minute alarms before meetings.
            </Text>
          </View>
          <TouchableOpacity
            onPress={requestPermissions}
            style={[styles.enableBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.enableBtnText}>Enable</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
              onPressMeeting={(id) =>
                router.push({ pathname: '/meeting/[id]', params: { id } })
              }
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerTextCol: {
    flex: 1,
    marginHorizontal: 10,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  bannerDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  enableBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  enableBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
