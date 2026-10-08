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
import * as Notifications from 'expo-notifications';
import { useUpcomingAlarms, useToggleAlarm } from '../../hooks/useAlarms';
import { useNotifications } from '../../hooks/useNotifications';
import { useTheme } from '../../hooks/useTheme';
import { AlarmWithMeeting } from '../../types/alarm';
import { Header } from '../../components/Header';
import { AlarmCard } from '../../components/AlarmCard';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Button } from '../../components/Button';
import { NOTIFICATION_CHANNELS } from '../../constants/alarms';

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
          'Please enable notifications in device settings to receive meeting alarms.'
        );
        return;
      }
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Test Alarm: Team Sync is starting now',
          body: 'Google Meet • 10:00 AM – 11:00 AM',
          sound: 'alarm.wav',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { test: true },
        },
        trigger: {
          seconds: 2,
          channelId: NOTIFICATION_CHANNELS.HIGH_PRIORITY_ALARMS,
        },
      });
      Alert.alert(
        'Test Alarm Scheduled',
        'You will receive a notification in 2 seconds.'
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

      {/* Permission Warning Banner */}
      {!isGranted && (
        <View
          style={[
            styles.warningBanner,
            {
              backgroundColor: colors.warningLight,
              borderColor: colors.warningBorder,
            },
          ]}
        >
          <Ionicons name="warning" size={20} color={colors.warning} />
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={[styles.warningTitle, { color: colors.text }]}>
              Notifications are disabled
            </Text>
            <Text style={[styles.warningDesc, { color: colors.textMuted }]}>
              Grant permission so alarms can alert you on time.
            </Text>
          </View>
          <Button
            title="Enable"
            onPress={requestPermissions}
            size="sm"
            variant="primary"
          />
        </View>
      )}

      {isLoading && upcomingAlarms.length === 0 ? (
        <LoadingState count={4} />
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  warningDesc: {
    fontSize: 11,
  },
});
