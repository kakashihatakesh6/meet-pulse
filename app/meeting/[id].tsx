import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useMeetingDetails,
  useDeleteMeeting,
} from '../../hooks/useMeetings';
import {
  useConfigureMeetingAlarms,
  useToggleAlarm,
} from '../../hooks/useAlarms';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { AlarmSelector } from '../../components/AlarmSelector';
import { MeetingStatusBadge } from '../../components/MeetingStatusBadge';
import { MeetingDetailsSkeleton } from '../../components/Skeleton';
import { formatMeetingTime, formatDuration, calculateDurationMinutes } from '../../utils/dates';
import { formatInTz } from '../../utils/timezone';
import { getPlatformDisplayInfo } from '../../utils/meeting-url';
import { formatAlarmOffsetLabel } from '../../constants/alarms';
import { Alarm } from '../../types/alarm';
import { Attendee } from '../../types/meeting';

export default function MeetingDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const meetingId = rawId ? decodeURIComponent(rawId) : '';
  const router = useRouter();
  const { colors } = useTheme();

  const { data: meeting, isLoading, refetch } = useMeetingDetails(meetingId);
  const deleteMeeting = useDeleteMeeting();
  const configureAlarms = useConfigureMeetingAlarms();
  const toggleAlarm = useToggleAlarm();

  const [isAlarmModalVisible, setIsAlarmModalVisible] = useState(false);

  // Refetch meeting details whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (meetingId) {
        refetch();
      }
    }, [meetingId, refetch])
  );

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Meeting Details
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <MeetingDetailsSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Meeting Details
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="calendar-outline" size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
            Meeting Not Found
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 20 }}>
            This meeting could not be found or may have been removed.
          </Text>
          <Button title="Go Back" onPress={() => router.back()} variant="primary" />
        </View>
      </SafeAreaView>
    );
  }

  const platformInfo = getPlatformDisplayInfo(meeting.platform);
  const durationMinutes = calculateDurationMinutes(
    meeting.startTime,
    meeting.endTime
  );
  const dateFormatted = formatInTz(meeting.startTime, 'EEEE, MMMM d, yyyy');
  const timeFormatted = formatMeetingTime(
    meeting.startTime,
    meeting.endTime,
    meeting.timezone,
    meeting.isAllDay
  );

  const activeAlarms = meeting.alarms || [];

  const handleJoinMeeting = () => {
    if (meeting.meetingUrl) {
      Linking.openURL(meeting.meetingUrl).catch((err) => {
        Alert.alert('Error', 'Unable to open meeting link.');
      });
    }
  };

  const handleSaveAlarms = async (offsets: number[]) => {
    await configureAlarms.mutateAsync({
      meeting,
      offsetMinutesList: offsets,
    });
    await refetch();
    setIsAlarmModalVisible(false);
  };

  const handleDeleteMeeting = () => {
    Alert.alert(
      'Delete Meeting',
      'Are you sure you want to delete this imported meeting and its alarms?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMeeting.mutateAsync(meeting.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Top Navigation Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          Meeting Details
        </Text>
        {meeting.source === 'imported' ? (
          <TouchableOpacity
            onPress={handleDeleteMeeting}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title and Badges */}
        <View style={styles.titleSection}>
          <View style={styles.badgeRow}>
            <MeetingStatusBadge status={meeting.status} />
            <View
              style={[
                styles.sourcePill,
                {
                  backgroundColor:
                    meeting.source === 'google_calendar'
                      ? colors.infoLight
                      : colors.accentLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.sourcePillText,
                  {
                    color:
                      meeting.source === 'google_calendar'
                        ? colors.info
                        : colors.accent,
                  },
                ]}
              >
                {meeting.source === 'google_calendar'
                  ? 'Google Calendar'
                  : 'Imported'}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {meeting.title}
          </Text>
        </View>

        {/* Time and Date Card */}
        <Card style={styles.timeCard}>
          <View style={styles.timeRow}>
            <View
              style={[
                styles.iconBg,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons name="time" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dateText, { color: colors.text }]}>
                {dateFormatted}
              </Text>
              <Text style={[styles.timeRangeText, { color: colors.textMuted }]}>
                {timeFormatted} ({formatDuration(durationMinutes)})
              </Text>
              <Text style={[styles.tzText, { color: colors.textSubtle }]}>
                Timezone: {meeting.timezone}
              </Text>
            </View>
          </View>

          {/* Join Meeting Action Button */}
          {meeting.meetingUrl && meeting.status !== 'cancelled' && (
            <Button
              title={`Join on ${platformInfo.label}`}
              onPress={handleJoinMeeting}
              variant="primary"
              size="lg"
              icon={platformInfo.iconName as keyof typeof Ionicons.glyphMap}
              style={styles.joinActionBtn}
            />
          )}
        </Card>

        {/* Alarms Configuration Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              SCHEDULED ALARMS ({activeAlarms.length})
            </Text>
            <TouchableOpacity
              onPress={() => setIsAlarmModalVisible(true)}
              style={styles.editAlarmBtn}
            >
              <Ionicons
                name="add-circle"
                size={16}
                color={colors.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.editAlarmText, { color: colors.primary }]}>
                Configure
              </Text>
            </TouchableOpacity>
          </View>

          <Card style={styles.alarmsCard}>
            {activeAlarms.length === 0 ? (
              <View style={styles.noAlarmsBox}>
                <Ionicons
                  name="notifications-off-outline"
                  size={24}
                  color={colors.textMuted}
                />
                <Text
                  style={[styles.noAlarmsText, { color: colors.textMuted }]}
                >
                  No alarms configured for this meeting.
                </Text>
                <Button
                  title="Add Reminder Alarm"
                  onPress={() => setIsAlarmModalVisible(true)}
                  size="sm"
                  variant="outline"
                  style={{ marginTop: 8 }}
                />
              </View>
            ) : (
              activeAlarms.map((alarm: Alarm, idx: number) => (
                <View key={`alarm-${alarm.id}-${idx}`} style={styles.alarmItemRow}>
                  <View style={styles.alarmLeft}>
                    <Ionicons
                      name={
                        alarm.isEnabled
                          ? 'notifications'
                          : 'notifications-off-outline'
                      }
                      size={18}
                      color={
                        alarm.isEnabled ? colors.primary : colors.textMuted
                      }
                      style={{ marginRight: 10 }}
                    />
                    <View>
                      <Text
                        style={[styles.alarmLabel, { color: colors.text }]}
                      >
                        {formatAlarmOffsetLabel(alarm.offsetMinutes)}
                      </Text>
                      <Text
                        style={[
                          styles.alarmRingTime,
                          { color: colors.textMuted },
                        ]}
                      >
                        Rings at {formatInTz(alarm.scheduledTime, 'h:mm a')}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() =>
                      toggleAlarm.mutate({
                        alarmId: alarm.id,
                        isEnabled: !alarm.isEnabled,
                        meeting,
                        offsetMinutes: alarm.offsetMinutes,
                      })
                    }
                  >
                    <Ionicons
                      name={alarm.isEnabled ? 'toggle' : 'toggle-outline'}
                      size={32}
                      color={
                        alarm.isEnabled ? colors.primary : colors.textSubtle
                      }
                    />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Card>
        </View>

        {/* Location & Links */}
        {(meeting.location || meeting.meetingUrl) && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              LOCATION & LINKS
            </Text>
            <Card style={styles.infoCard}>
              {meeting.location && (
                <View style={styles.infoRow}>
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={colors.primary}
                    style={{ marginRight: 10 }}
                  />
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    {meeting.location}
                  </Text>
                </View>
              )}
              {meeting.meetingUrl && (
                <View
                  style={[
                    styles.infoRow,
                    meeting.location ? { marginTop: 12 } : null,
                  ]}
                >
                  <Ionicons
                    name="link-outline"
                    size={18}
                    color={colors.primary}
                    style={{ marginRight: 10 }}
                  />
                  <Text
                    style={[styles.urlText, { color: colors.primary }]}
                    numberOfLines={1}
                    onPress={handleJoinMeeting}
                  >
                    {meeting.meetingUrl}
                  </Text>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Description / Notes */}
        {meeting.description && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              DESCRIPTION & AGENDA
            </Text>
            <Card style={styles.infoCard}>
              <Text style={[styles.descriptionText, { color: colors.text }]}>
                {meeting.description}
              </Text>
            </Card>
          </View>
        )}

        {/* Organizer & Attendees */}
        {(meeting.organizerName ||
          meeting.organizerEmail ||
          meeting.attendees.length > 0) && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              PARTICIPANTS ({meeting.attendees.length + (meeting.organizerName ? 1 : 0)})
            </Text>
            <Card style={styles.infoCard}>
              {meeting.organizerName && (
                <View style={styles.organizerRow}>
                  <Ionicons
                    name="person-circle"
                    size={22}
                    color={colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.participantName, { color: colors.text }]}
                    >
                      {meeting.organizerName} (Organizer)
                    </Text>
                    {meeting.organizerEmail ? (
                      <Text
                        style={[
                          styles.participantEmail,
                          { color: colors.textMuted },
                        ]}
                      >
                        {meeting.organizerEmail}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              {meeting.attendees.map((att: Attendee, idx: number) => (
                <View key={idx} style={styles.attendeeRow}>
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={colors.textMuted}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.participantName, { color: colors.text }]}
                    >
                      {att.displayName || att.email}
                    </Text>
                    {att.displayName && (
                      <Text
                        style={[
                          styles.participantEmail,
                          { color: colors.textMuted },
                        ]}
                      >
                        {att.email}
                      </Text>
                    )}
                  </View>
                  {att.responseStatus && (
                    <Text
                      style={[
                        styles.responseStatus,
                        {
                          color:
                            att.responseStatus === 'accepted'
                              ? colors.success
                              : att.responseStatus === 'declined'
                              ? colors.danger
                              : colors.warning,
                        },
                      ]}
                    >
                      {att.responseStatus.toUpperCase()}
                    </Text>
                  )}
                </View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Alarm Modal */}
      <AlarmSelector
        visible={isAlarmModalVisible}
        meetingTitle={meeting.title}
        initialOffsets={activeAlarms
          .filter((a: Alarm) => a.isEnabled)
          .map((a: Alarm) => a.offsetMinutes)}
        onSave={handleSaveAlarms}
        onClose={() => setIsAlarmModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  titleSection: {
    marginVertical: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  timeCard: {
    padding: 16,
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  timeRangeText: {
    fontSize: 13,
    marginBottom: 2,
  },
  tzText: {
    fontSize: 11,
  },
  joinActionBtn: {
    marginTop: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  editAlarmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editAlarmText: {
    fontSize: 12,
    fontWeight: '700',
  },
  alarmsCard: {
    padding: 14,
  },
  noAlarmsBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  noAlarmsText: {
    fontSize: 13,
    marginTop: 6,
  },
  alarmItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  alarmLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alarmLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  alarmRingTime: {
    fontSize: 11,
    marginTop: 1,
  },
  infoCard: {
    padding: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  urlText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textDecorationLine: 'underline',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  participantName: {
    fontSize: 13,
    fontWeight: '600',
  },
  participantEmail: {
    fontSize: 11,
  },
  responseStatus: {
    fontSize: 10,
    fontWeight: '700',
  },
});
