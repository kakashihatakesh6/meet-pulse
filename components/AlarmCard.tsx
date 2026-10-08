import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AlarmWithMeeting } from '../services/database/repositories/alarms.repository';
import { useTheme } from '../hooks/useTheme';
import { formatAlarmOffsetLabel } from '../constants/alarms';
import { formatInTz } from '../utils/timezone';
import { formatMeetingTime } from '../utils/dates';

export interface AlarmCardProps {
  alarmWithMeeting: AlarmWithMeeting;
  onToggle: (alarmId: string, isEnabled: boolean) => void;
  onDelete?: (alarmId: string) => void;
  onPressMeeting?: (meetingId: string) => void;
}

export const AlarmCard: React.FC<AlarmCardProps> = ({
  alarmWithMeeting,
  onToggle,
  onDelete,
  onPressMeeting,
}) => {
  const { colors } = useTheme();
  const { meeting } = alarmWithMeeting;

  const triggerTimeFormatted = formatInTz(
    alarmWithMeeting.scheduledTime,
    'h:mm a • EEE, MMM d'
  );

  const meetingTime = formatMeetingTime(
    meeting.startTime,
    meeting.endTime,
    meeting.timezone,
    meeting.isAllDay
  );

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPressMeeting?.(meeting.id)}
      style={[
        styles.container,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      <View style={styles.leftContent}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: alarmWithMeeting.isEnabled
                ? colors.primaryLight
                : colors.surfaceSubtle,
            },
          ]}
        >
          <Ionicons
            name={
              alarmWithMeeting.isEnabled
                ? 'notifications'
                : 'notifications-off-outline'
            }
            size={18}
            color={
              alarmWithMeeting.isEnabled ? colors.primary : colors.textMuted
            }
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.offsetLabel, { color: colors.text }]}>
            {formatAlarmOffsetLabel(alarmWithMeeting.offsetMinutes)}
          </Text>
          <Text style={[styles.meetingTitle, { color: colors.textMuted }]} numberOfLines={1}>
            {meeting.title}
          </Text>
          <Text style={[styles.timeDetail, { color: colors.primary }]}>
            Rings at: {triggerTimeFormatted}
          </Text>
        </View>
      </View>

      <View style={styles.rightActions}>
        <Switch
          value={alarmWithMeeting.isEnabled}
          onValueChange={(val) => onToggle(alarmWithMeeting.id, val)}
          trackColor={{ false: colors.surfaceSubtle, true: colors.primaryLight }}
          thumbColor={alarmWithMeeting.isEnabled ? colors.primary : colors.textSubtle}
        />
        {onDelete && (
          <TouchableOpacity
            onPress={() => onDelete(alarmWithMeeting.id)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  offsetLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  meetingTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  timeDetail: {
    fontSize: 11,
    fontWeight: '600',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 6,
  },
});
