import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MeetingsRepository } from '../services/database/repositories/meetings.repository';
import { NotificationService } from '../services/notifications/notification.service';
import { MeetingWithAlarms, MeetingFilterOptions } from '../types/meeting';
import { getDeviceTimezone } from '../utils/timezone';

export const MEETINGS_QUERY_KEYS = {
  all: ['meetings'] as const,
  today: (tz?: string) => ['meetings', 'today', tz] as const,
  upcoming: (limit?: number) => ['meetings', 'upcoming', limit] as const,
  range: (start: string, end: string, filter?: MeetingFilterOptions) =>
    ['meetings', 'range', start, end, filter] as const,
  detail: (id: string) => ['meetings', 'detail', id] as const,
  search: (query: string) => ['meetings', 'search', query] as const,
  counts: ['meetings', 'counts'] as const,
};

export function useTodayMeetings(timezone?: string) {
  const tz = timezone || getDeviceTimezone();
  return useQuery({
    queryKey: MEETINGS_QUERY_KEYS.today(tz),
    queryFn: () => MeetingsRepository.getTodayMeetings(tz),
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useUpcomingMeetings(limit: number = 50) {
  return useQuery({
    queryKey: MEETINGS_QUERY_KEYS.upcoming(limit),
    queryFn: () => MeetingsRepository.getUpcomingMeetings(limit),
    staleTime: 1000 * 30,
  });
}

export function usePastMeetings(limit: number = 50) {
  return useQuery({
    queryKey: ['meetings', 'past', limit] as const,
    queryFn: () => MeetingsRepository.getPastMeetings(limit),
    staleTime: 1000 * 30,
  });
}

export function useAllMeetings(limit: number = 250) {
  return useQuery({
    queryKey: ['meetings', 'all_list', limit] as const,
    queryFn: () => MeetingsRepository.getAllMeetings(limit),
    staleTime: 1000 * 30,
  });
}

export function useDateRangeMeetings(
  startIso: string,
  endIso: string,
  filter?: MeetingFilterOptions
) {
  return useQuery({
    queryKey: MEETINGS_QUERY_KEYS.range(startIso, endIso, filter),
    queryFn: () => MeetingsRepository.getMeetingsByDateRange(startIso, endIso, filter),
    enabled: !!startIso && !!endIso,
    staleTime: 1000 * 30,
  });
}

export function useMeetingDetails(meetingId?: string) {
  return useQuery({
    queryKey: MEETINGS_QUERY_KEYS.detail(meetingId || ''),
    queryFn: () => (meetingId ? MeetingsRepository.getById(meetingId) : null),
    enabled: !!meetingId,
  });
}

export function useSearchMeetings(query: string) {
  return useQuery({
    queryKey: MEETINGS_QUERY_KEYS.search(query),
    queryFn: () => (query.trim() ? MeetingsRepository.searchMeetings(query.trim()) : []),
    enabled: query.trim().length > 0,
  });
}

export function useMeetingCounts() {
  return useQuery({
    queryKey: MEETINGS_QUERY_KEYS.counts,
    queryFn: () => MeetingsRepository.getCounts(),
    staleTime: 1000 * 30,
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) => {
      await NotificationService.cancelAllAlarmsForMeeting(meetingId);
      await MeetingsRepository.deleteImportedMeeting(meetingId);
      return meetingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEYS.all });
    },
  });
}
