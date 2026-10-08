import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlarmsRepository } from '../services/database/repositories/alarms.repository';
import { NotificationService } from '../services/notifications/notification.service';
import { Meeting } from '../types/meeting';
import { MEETINGS_QUERY_KEYS } from './useMeetings';

export const ALARMS_QUERY_KEYS = {
  all: ['alarms'] as const,
  upcoming: (limit?: number) => ['alarms', 'upcoming', limit] as const,
  forMeeting: (meetingId: string) => ['alarms', 'meeting', meetingId] as const,
};

export function useUpcomingAlarms(limit: number = 50) {
  return useQuery({
    queryKey: ALARMS_QUERY_KEYS.upcoming(limit),
    queryFn: () => AlarmsRepository.getUpcomingAlarmsWithMeetings(limit),
    staleTime: 1000 * 30,
  });
}

export function useConfigureMeetingAlarms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      meeting,
      offsetMinutesList,
    }: {
      meeting: Meeting;
      offsetMinutesList: number[];
    }) => {
      return NotificationService.configureMeetingAlarms(meeting, offsetMinutesList);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ALARMS_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: MEETINGS_QUERY_KEYS.detail(variables.meeting.id),
      });
      queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEYS.all });
    },
  });
}

export function useToggleAlarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      alarmId,
      isEnabled,
      meeting,
      offsetMinutes,
    }: {
      alarmId: string;
      isEnabled: boolean;
      meeting?: Meeting;
      offsetMinutes?: number;
    }) => {
      const alarm = await AlarmsRepository.getById(alarmId);
      if (!alarm) throw new Error('Alarm not found');

      if (!isEnabled) {
        // Cancel notification
        if (alarm.notificationId) {
          await NotificationService.cancelNotification(alarm.notificationId);
        }
        await AlarmsRepository.update(alarmId, {
          isEnabled: false,
          notificationId: undefined,
        });
      } else if (meeting && offsetMinutes !== undefined) {
        // Reschedule
        const { notificationId, scheduledTime } =
          await NotificationService.scheduleAlarmNotification(meeting, offsetMinutes);
        await AlarmsRepository.update(alarmId, {
          isEnabled: true,
          notificationId,
          scheduledTime,
        });
      } else {
        await AlarmsRepository.update(alarmId, { isEnabled: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ALARMS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEYS.all });
    },
  });
}
