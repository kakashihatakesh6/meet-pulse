import { GoogleOAuthService } from '../google/oauth';
import { GoogleCalendarService } from '../google/calendar';
import { CalendarsRepository } from '../database/repositories/calendars.repository';
import { MeetingsRepository } from '../database/repositories/meetings.repository';
import { SyncRepository } from '../database/repositories/sync.repository';
import { SettingsRepository } from '../database/repositories/settings.repository';
import { AlarmService } from '../alarms/alarm.service';
import { NotificationService } from '../notifications/notification.service';
import { SyncResult } from '../../types/sync';
import { logger } from '../../utils/logger';

export const CalendarSyncService = {
  /**
   * Performs a complete synchronization of all enabled Google Calendars
   */
  async syncAllCalendars(options: { forceFullSync?: boolean } = {}): Promise<SyncResult> {
    const syncTimestamp = new Date().toISOString();
    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    let alarmsScheduledCount = 0;

    // Check if user is authenticated
    const tokens = await GoogleOAuthService.getStoredTokens();
    if (!tokens?.accessToken) {
      logger.info('Cannot sync: User is not authenticated');
      return {
        success: false,
        addedCount: 0,
        updatedCount: 0,
        deletedCount: 0,
        alarmsScheduledCount: 0,
        syncTimestamp,
        error: 'Not authenticated with Google',
      };
    }

    try {
      logger.info('Starting Google Calendar synchronization...');

      // 1. Sync Calendar List
      try {
        const remoteCalendars = await GoogleCalendarService.fetchCalendarList();
        if (remoteCalendars.length > 0) {
          await CalendarsRepository.batchUpsert(remoteCalendars);
        }
      } catch (calErr) {
        logger.warn('Failed to refresh calendar list, proceeding with cached calendars', calErr);
      }

      // 2. Get all enabled calendars from local DB
      let enabledCalendars = await CalendarsRepository.getEnabled();
      if (enabledCalendars.length === 0) {
        // Fallback: If no calendars in DB, try primary
        enabledCalendars.push({
          id: 'primary',
          googleCalendarId: 'primary',
          summary: 'Primary Calendar',
          primary: true,
          backgroundColor: '#4F46E5',
          foregroundColor: '#FFFFFF',
          isEnabled: true,
          accessRole: 'owner',
        });
      } else {
        // Ensure primary is present in the sync list
        const hasPrimary = enabledCalendars.some((c) => c.primary || c.googleCalendarId === 'primary');
        if (!hasPrimary) {
          enabledCalendars.unshift({
            id: 'primary',
            googleCalendarId: 'primary',
            summary: 'Primary Calendar',
            primary: true,
            backgroundColor: '#4F46E5',
            foregroundColor: '#FFFFFF',
            isEnabled: true,
            accessRole: 'owner',
          });
        }
      }

      // Sort so primary and owned calendars are always synchronized first
      enabledCalendars.sort((a, b) => {
        if (a.primary && !b.primary) return -1;
        if (!a.primary && b.primary) return 1;
        if (a.accessRole === 'owner' && b.accessRole !== 'owner') return -1;
        if (a.accessRole !== 'owner' && b.accessRole === 'owner') return 1;
        return 0;
      });

      // Read default alarm settings
      const settings = await SettingsRepository.getAllSettings();
      const defaultOffsets = settings.defaultAlarmOffsets || [15];

      // 3. Process each calendar
      for (const cal of enabledCalendars) {
        await SyncRepository.updateStatus(cal.googleCalendarId, 'syncing');

        try {
          const syncMeta = await SyncRepository.get(cal.googleCalendarId);
          const syncToken = options.forceFullSync ? undefined : syncMeta?.syncToken;

          let eventsResponse = await GoogleCalendarService.fetchEvents(
            cal.googleCalendarId,
            { syncToken }
          );

          let items = eventsResponse.items;
          let nextSyncToken = eventsResponse.nextSyncToken;

          if (eventsResponse.isFullSyncRequired || (syncToken && items.length === 0) || options.forceFullSync) {
            const fullResponse = await GoogleCalendarService.fetchEvents(
              cal.googleCalendarId,
              { syncToken: undefined }
            );
            if (fullResponse.items.length > 0 || eventsResponse.isFullSyncRequired) {
              items = fullResponse.items;
              nextSyncToken = fullResponse.nextSyncToken;
            }
          }

          // If this is the primary calendar and still 0 items, try the canonical 'primary' endpoint
          if (cal.primary && items.length === 0 && cal.googleCalendarId !== 'primary') {
            try {
              const primaryResp = await GoogleCalendarService.fetchEvents('primary', {
                syncToken: undefined,
              });
              if (primaryResp.items.length > 0) {
                items = primaryResp.items;
                nextSyncToken = primaryResp.nextSyncToken;
              }
            } catch (pErr) {
              logger.warn('Fallback to primary calendar endpoint failed', pErr);
            }
          }

          logger.info(`Fetched ${items.length} events for calendar "${cal.summary}" (${cal.googleCalendarId})`);

          // Process each event
          for (const item of items) {
            if (!item.id) continue;

            // Handle cancelled/deleted events
            if (item.status === 'cancelled') {
              const existingMeeting = await MeetingsRepository.getByGoogleEventId(item.id);
              if (existingMeeting) {
                await MeetingsRepository.updateMeeting(existingMeeting.id, {
                  status: 'cancelled',
                });
                await AlarmService.cancelAllAlarmsForMeeting(existingMeeting.id);
                if (settings.enableNotifications) {
                  await NotificationService.sendMeetingCancelledNotification(existingMeeting.title);
                }
                deletedCount++;
              }
              continue;
            }

            // Normalize event
            const normalizedInput = GoogleCalendarService.normalizeGoogleEvent(
              item,
              cal.googleCalendarId,
              cal.timeZone
            );

            if (!normalizedInput) continue;

            const existingMeeting = await MeetingsRepository.getByGoogleEventId(item.id);

            if (existingMeeting) {
              const hasTimeChanged =
                existingMeeting.startTime !== normalizedInput.startTime ||
                existingMeeting.endTime !== normalizedInput.endTime;

              const updatedMeeting = await MeetingsRepository.upsertGoogleMeeting(normalizedInput);
              updatedCount++;

              if (hasTimeChanged) {
                // Reschedule alarms for updated times
                await AlarmService.rescheduleMeetingAlarms(updatedMeeting);
                if (settings.enableNotifications) {
                  await NotificationService.sendMeetingRescheduledNotification(
                    updatedMeeting,
                    existingMeeting.startTime
                  );
                }
              }
            } else {
              // New Meeting
              const createdMeeting = await MeetingsRepository.upsertGoogleMeeting(normalizedInput);
              addedCount++;

              // Auto-schedule default alarms
              if (settings.enableNotifications && defaultOffsets.length > 0) {
                const alarms = await AlarmService.configureMeetingAlarms(
                  createdMeeting,
                  defaultOffsets
                );
                alarmsScheduledCount += alarms.length;
              }
            }
          }

          // Save nextSyncToken for efficient incremental sync next time
          await SyncRepository.set({
            calendarId: cal.googleCalendarId,
            syncToken: nextSyncToken,
            lastSyncTimestamp: syncTimestamp,
            status: 'success',
          });

          await CalendarsRepository.updateLastSynced(cal.googleCalendarId, syncTimestamp);
        } catch (calSyncErr) {
          logger.error(`Error syncing calendar ${cal.googleCalendarId}`, calSyncErr);
          await SyncRepository.updateStatus(
            cal.googleCalendarId,
            'error',
            String(calSyncErr)
          );
        }
      }

      logger.info(
        `Sync completed: +${addedCount} added, ~${updatedCount} updated, -${deletedCount} cancelled, ${alarmsScheduledCount} alarms scheduled`
      );

      return {
        success: true,
        addedCount,
        updatedCount,
        deletedCount,
        alarmsScheduledCount,
        syncTimestamp,
      };
    } catch (err) {
      logger.error('Calendar synchronization failed', err);
      return {
        success: false,
        addedCount,
        updatedCount,
        deletedCount,
        alarmsScheduledCount,
        syncTimestamp,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
