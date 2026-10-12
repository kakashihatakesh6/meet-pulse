import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTodayMeetings, useUpcomingMeetings, useMeetingCounts } from '../../hooks/useMeetings';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useConfigureMeetingAlarms } from '../../hooks/useAlarms';
import { useAuthStore } from '../../store/auth.store';
import { useTheme } from '../../hooks/useTheme';
import { Header } from '../../components/Header';
import { MeetingCard } from '../../components/MeetingCard';
import { AlarmSelector } from '../../components/AlarmSelector';
import { LoadingState, DashboardSkeleton } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { MeetingWithAlarms } from '../../types/meeting';
import { Alarm } from '../../types/alarm';
import { formatMeetingTime, getRelativeTimeLabel } from '../../utils/dates';
import { getPlatformDisplayInfo } from '../../utils/meeting-url';

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { sync, isSyncing } = useCalendarSync();

  const {
    data: todayMeetings = [],
    isLoading: isLoadingMeetings,
    refetch: refetchMeetings,
  } = useTodayMeetings();

  const { data: upcomingMeetings = [], refetch: refetchUpcoming } = useUpcomingMeetings(10);
  const { data: counts, refetch: refetchCounts } = useMeetingCounts();
  const configureAlarms = useConfigureMeetingAlarms();

  // Alarm modal state
  const [activeMeetingForAlarm, setActiveMeetingForAlarm] =
    useState<MeetingWithAlarms | null>(null);

  // Auto-sync on initial mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      sync({ forceFullSync: true });
    }
  }, [isAuthenticated, sync]);

  // Refetch data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      refetchMeetings();
      refetchUpcoming();
      refetchCounts();
    }, [refetchMeetings, refetchUpcoming, refetchCounts])
  );

  const handleRefresh = async () => {
    await Promise.all([
      sync({ forceFullSync: true }),
      refetchMeetings(),
      refetchUpcoming(),
      refetchCounts(),
    ]);
  };

  const handleSaveAlarms = async (selectedOffsets: number[]) => {
    if (activeMeetingForAlarm) {
      await configureAlarms.mutateAsync({
        meeting: activeMeetingForAlarm,
        offsetMinutesList: selectedOffsets,
      });
      await Promise.all([refetchMeetings(), refetchUpcoming()]);
      setActiveMeetingForAlarm(null);
    }
  };

  // Find next upcoming/in-progress meeting (checking today's meetings first, then upcoming)
  const nextMeeting =
    todayMeetings.find(
      (m) => m.status === 'upcoming' || m.status === 'in_progress'
    ) ||
    upcomingMeetings.find(
      (m) => m.status === 'upcoming' || m.status === 'in_progress'
    );

  const meetingsWithoutAlarms = todayMeetings.filter(
    (m) => m.alarms.filter((a: Alarm) => a.isEnabled).length === 0
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Top Header */}
        <Header showUserGreeting showSyncIndicator />

        {isLoadingMeetings && todayMeetings.length === 0 && upcomingMeetings.length === 0 ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Quick Actions Row */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => sync({ forceFullSync: true })}
                disabled={isSyncing}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.actionIconBg,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Ionicons name="sync" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  {isSyncing ? 'Syncing...' : 'Sync Calendar'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => router.push('/import')}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.actionIconBg,
                    { backgroundColor: colors.accentLight },
                  ]}
                >
                  <Ionicons
                    name="cloud-upload"
                    size={18}
                    color={colors.accent}
                  />
                </View>
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  Import File
                </Text>
              </TouchableOpacity>
            </View>

            {/* Next Meeting Spotlight Card */}
            {nextMeeting ? (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  NEXT UP
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: '/meeting/[id]',
                      params: { id: nextMeeting.id },
                    })
                  }
                >
                  <Card
                    style={[
                      styles.spotlightCard,
                      { borderColor: colors.primary, borderWidth: 1.5 },
                    ]}
                  >
                    <View style={styles.spotlightHeader}>
                      <View style={styles.spotlightTimeGroup}>
                        <Ionicons
                          name="flash"
                          size={16}
                          color={colors.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[styles.spotlightRelative, { color: colors.primary }]}
                        >
                          {getRelativeTimeLabel(nextMeeting.startTime, nextMeeting.endTime).label}
                        </Text>
                      </View>
                      <Text
                        style={[styles.spotlightTime, { color: colors.textMuted }]}
                      >
                        {formatMeetingTime(
                          nextMeeting.startTime,
                          nextMeeting.endTime,
                          nextMeeting.timezone,
                          nextMeeting.isAllDay
                        )}
                      </Text>
                    </View>

                    <Text
                      style={[styles.spotlightTitle, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {nextMeeting.title}
                    </Text>

                    <View style={styles.spotlightBottom}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={(e) => {
                          e.stopPropagation();
                          setActiveMeetingForAlarm(nextMeeting);
                        }}
                        style={[
                          styles.spotlightAlarmBtn,
                          { backgroundColor: colors.surfaceSubtle },
                        ]}
                      >
                        <Ionicons
                          name={
                            nextMeeting.alarms.some((a: Alarm) => a.isEnabled)
                              ? 'notifications'
                              : 'notifications-outline'
                          }
                          size={14}
                          color={colors.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[styles.spotlightAlarmText, { color: colors.text }]}
                        >
                          {nextMeeting.alarms.filter((a: Alarm) => a.isEnabled).length > 0
                            ? `${nextMeeting.alarms.filter((a: Alarm) => a.isEnabled).length} alarm(s)`
                            : 'Add Alarm'}
                        </Text>
                      </TouchableOpacity>

                      {nextMeeting.meetingUrl && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={(e) => {
                            e.stopPropagation();
                            Linking.openURL(nextMeeting.meetingUrl!).catch(() => {});
                          }}
                          style={[
                            styles.spotlightJoinBtn,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Ionicons
                            name="videocam"
                            size={14}
                            color="#FFFFFF"
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.spotlightJoinText}>Join Now</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Stats Metrics Row */}
            <View style={styles.statsRow}>
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <Text style={[styles.statNumber, { color: colors.primary }]}>
                  {todayMeetings.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  Today's
                </Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <Text style={[styles.statNumber, { color: colors.accent }]}>
                  {upcomingMeetings.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  Upcoming
                </Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statNumber,
                    {
                      color:
                        meetingsWithoutAlarms.length > 0
                          ? colors.warning
                          : colors.success,
                    },
                  ]}
                >
                  {meetingsWithoutAlarms.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  No Alarms
                </Text>
              </View>
            </View>

            {/* Today's Meetings List */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  TODAY'S SCHEDULE ({todayMeetings.length})
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/calendar')}
                  style={{ paddingVertical: 2 }}
                >
                  <Text style={[styles.viewAllText, { color: colors.primary }]}>
                    View Calendar →
                  </Text>
                </TouchableOpacity>
              </View>

              {todayMeetings.length === 0 ? (
                <View
                  style={[
                    styles.emptyTodayBanner,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.surfaceBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.success}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.emptyTodayTitle, { color: colors.text }]}>
                      Calendar clear for today
                    </Text>
                    <Text style={[styles.emptyTodayDesc, { color: colors.textMuted }]}>
                      No meetings remaining today. Check upcoming events below.
                    </Text>
                  </View>
                </View>
              ) : (
                todayMeetings.map((meeting, index) => (
                  <MeetingCard
                    key={`today-${meeting.id}-${index}`}
                    meeting={meeting}
                    onAlarmPress={(m) => setActiveMeetingForAlarm(m)}
                  />
                ))
              )}
            </View>

            {/* Upcoming Meetings List */}
            {upcomingMeetings.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                    UPCOMING SCHEDULE ({upcomingMeetings.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/calendar')}
                    style={{ paddingVertical: 2 }}
                  >
                    <Text style={[styles.viewAllText, { color: colors.primary }]}>
                      All →
                    </Text>
                  </TouchableOpacity>
                </View>

                {upcomingMeetings.slice(0, 5).map((meeting, index) => (
                  <MeetingCard
                    key={`upcoming-${meeting.id}-${index}`}
                    meeting={meeting}
                    onAlarmPress={(m) => setActiveMeetingForAlarm(m)}
                  />
                ))}
              </View>
            )}

            {/* Empty State when zero total meetings exist */}
            {todayMeetings.length === 0 && upcomingMeetings.length === 0 && (
              <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                <EmptyState
                  icon="calendar-outline"
                  title="No Calendar Meetings Found"
                  description="Sync your Google Calendar or import an Excel/CSV schedule to view and manage meeting alarms."
                  actionLabel="Sync Google Calendar"
                  onAction={() => sync({ forceFullSync: true })}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Alarm Configuration Modal */}
      {activeMeetingForAlarm && (
        <AlarmSelector
          visible={!!activeMeetingForAlarm}
          meetingTitle={activeMeetingForAlarm.title}
          initialOffsets={activeMeetingForAlarm.alarms
            .filter((a: Alarm) => a.isEnabled)
            .map((a: Alarm) => a.offsetMinutes)}
          onSave={handleSaveAlarms}
          onClose={() => setActiveMeetingForAlarm(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginVertical: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  actionIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  spotlightCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  spotlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  spotlightTimeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spotlightRelative: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  spotlightTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  spotlightTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 14,
    lineHeight: 22,
  },
  spotlightBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spotlightAlarmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  spotlightAlarmText: {
    fontSize: 12,
    fontWeight: '600',
  },
  spotlightJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  spotlightJoinText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyTodayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  emptyTodayTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptyTodayDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
});
