import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MeetingWithAlarms } from '../types/meeting';
import { useTheme } from '../hooks/useTheme';
import { formatMeetingTime, formatMeetingDate, formatDuration, calculateDurationMinutes, getRelativeTimeLabel } from '../utils/dates';
import { getPlatformDisplayInfo } from '../utils/meeting-url';
import { MeetingStatusBadge } from './MeetingStatusBadge';
import { formatAlarmOffsetLabel } from '../constants/alarms';

export interface MeetingCardProps {
  meeting: MeetingWithAlarms;
  onAlarmPress?: (meeting: MeetingWithAlarms) => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  onAlarmPress,
}) => {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const durationMinutes = calculateDurationMinutes(meeting.startTime, meeting.endTime);
  const dateFormatted = formatMeetingDate(meeting.startTime, meeting.timezone);
  const timeFormatted = formatMeetingTime(
    meeting.startTime,
    meeting.endTime,
    meeting.timezone,
    meeting.isAllDay
  );
  const relativeTime = getRelativeTimeLabel(meeting.startTime, meeting.endTime);
  const platformInfo = getPlatformDisplayInfo(meeting.platform);

  // Active alarms summary
  const activeAlarms = meeting.alarms.filter((a) => a.isEnabled);
  const hasAlarms = activeAlarms.length > 0;

  const handleCardPress = () => {
    router.push(`/meeting/${meeting.id}`);
  };

  const handleJoinPress = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (meeting.meetingUrl) {
      Linking.openURL(meeting.meetingUrl).catch(() => {});
    }
  };

  const handleAlarmButtonPress = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (onAlarmPress) {
      onAlarmPress(meeting);
    } else {
      router.push(`/meeting/${meeting.id}`);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleCardPress}
      style={[
        styles.container,
        {
          backgroundColor:
            meeting.status === 'in_progress'
              ? isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4'
              : colors.cardBg,
          borderColor:
            meeting.status === 'in_progress'
              ? colors.success
              : relativeTime.urgency === 'urgent'
              ? colors.primary
              : colors.cardBorder,
          borderWidth: meeting.status === 'in_progress' || relativeTime.urgency === 'urgent' ? 1.5 : 1,
        },
      ]}
    >
      {/* Top Row: Date, Time Range, Duration, Status */}
      <View style={styles.topRow}>
        <View style={styles.timeGroup}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color={meeting.status === 'in_progress' ? colors.success : colors.primary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.dateText,
              { color: meeting.status === 'in_progress' ? colors.success : colors.primary },
            ]}
          >
            {dateFormatted}
          </Text>
          <Text style={[styles.timeSeparator, { color: colors.textMuted }]}>
            •
          </Text>
          <Text style={[styles.timeText, { color: colors.text }]}>
            {timeFormatted}
          </Text>
          <View
            style={[
              styles.durationBadge,
              { backgroundColor: colors.surfaceSubtle },
            ]}
          >
            <Text style={[styles.durationText, { color: colors.textMuted }]}>
              {formatDuration(durationMinutes)}
            </Text>
          </View>
        </View>

        <MeetingStatusBadge status={meeting.status} size="sm" />
      </View>

      {/* Meeting Title */}
      <Text
        style={[styles.title, { color: colors.text }]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {meeting.title}
      </Text>

      {/* Relative Urgency Banner (e.g. "Starts in 15 mins", "Ended 2h ago") */}
      {meeting.status !== 'cancelled' && (
        <View style={styles.relativeRow}>
          <Ionicons
            name={
              meeting.status === 'completed'
                ? 'checkmark-done-circle-outline'
                : meeting.status === 'in_progress'
                ? 'radio-button-on'
                : 'time-outline'
            }
            size={13}
            color={
              meeting.status === 'in_progress'
                ? colors.success
                : relativeTime.urgency === 'urgent'
                ? colors.danger
                : relativeTime.urgency === 'soon'
                ? colors.warning
                : colors.textMuted
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.relativeText,
              {
                color:
                  meeting.status === 'in_progress'
                    ? colors.success
                    : relativeTime.urgency === 'urgent'
                    ? colors.danger
                    : relativeTime.urgency === 'soon'
                    ? colors.warning
                    : colors.textMuted,
              },
            ]}
          >
            {relativeTime.label}
          </Text>
        </View>
      )}

      {/* Platform, Location & Source Badges */}
      <View style={styles.badgesRow}>
        {meeting.platform !== 'none' && (
          <View
            style={[
              styles.platformBadge,
              { backgroundColor: colors.surfaceSubtle },
            ]}
          >
            <Ionicons
              name={platformInfo.iconName as keyof typeof Ionicons.glyphMap}
              size={12}
              color={colors.primary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {platformInfo.label}
            </Text>
          </View>
        )}

        {meeting.location && !meeting.location.startsWith('http') && (
          <View
            style={[
              styles.platformBadge,
              { backgroundColor: colors.surfaceSubtle, maxWidth: 180 },
            ]}
          >
            <Ionicons
              name="location-outline"
              size={12}
              color={colors.textMuted}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[styles.badgeText, { color: colors.text }]}
              numberOfLines={1}
            >
              {meeting.location}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.platformBadge,
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
              styles.badgeText,
              {
                color:
                  meeting.source === 'google_calendar'
                    ? colors.info
                    : colors.accent,
                fontSize: 11,
              },
            ]}
          >
            {meeting.source === 'google_calendar' ? 'Google Calendar' : 'Imported'}
          </Text>
        </View>

        {meeting.attendees.length > 0 && (
          <View style={styles.attendeesBadge}>
            <Ionicons
              name="people-outline"
              size={12}
              color={colors.textMuted}
              style={{ marginRight: 3 }}
            />
            <Text style={[styles.attendeesText, { color: colors.textMuted }]}>
              {meeting.attendees.length}
            </Text>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />

      {/* Bottom Row: Alarm Status + Join Button */}
      <View style={styles.bottomRow}>
        {/* Alarm Info Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleAlarmButtonPress}
          style={[
            styles.alarmButton,
            {
              backgroundColor: hasAlarms ? colors.primaryLight : colors.surfaceSubtle,
            },
          ]}
        >
          <Ionicons
            name={hasAlarms ? 'notifications' : 'notifications-outline'}
            size={13}
            color={hasAlarms ? colors.primary : colors.textMuted}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.alarmText,
              { color: hasAlarms ? colors.primary : colors.textMuted },
            ]}
          >
            {hasAlarms
              ? activeAlarms.map((a) => formatAlarmOffsetLabel(a.offsetMinutes)).join(', ')
              : 'Add Alarm'}
          </Text>
        </TouchableOpacity>

        {/* Join Meeting Action */}
        {meeting.meetingUrl && meeting.status !== 'cancelled' && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleJoinPress}
            style={[
              styles.joinButton,
              {
                backgroundColor:
                  meeting.status === 'in_progress'
                    ? colors.success
                    : meeting.platform === 'google_meet'
                    ? '#00832D'
                    : meeting.platform === 'zoom'
                    ? '#2D8CFF'
                    : colors.primary,
              },
            ]}
          >
            <Ionicons
              name="videocam"
              size={14}
              color="#FFFFFF"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.joinText}>
              {meeting.status === 'in_progress' ? 'Join Now' : 'Join'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  timeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    flexShrink: 1,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeSeparator: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  durationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 2,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
  },
  relativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  relativeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  attendeesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  attendeesText: {
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginBottom: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alarmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexShrink: 1,
    marginRight: 8,
  },
  alarmText: {
    fontSize: 11,
    fontWeight: '600',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  joinText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
