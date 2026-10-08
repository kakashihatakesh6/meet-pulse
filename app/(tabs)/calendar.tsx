import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  subDays,
  addDays,
  format,
  isSameDay,
} from 'date-fns';
import { useDateRangeMeetings, useSearchMeetings } from '../../hooks/useMeetings';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useConfigureMeetingAlarms } from '../../hooks/useAlarms';
import { useTheme } from '../../hooks/useTheme';
import { Header } from '../../components/Header';
import { MeetingList } from '../../components/MeetingList';
import { AlarmSelector } from '../../components/AlarmSelector';
import { MeetingWithAlarms, MeetingSource } from '../../types/meeting';
import { getWeekDates } from '../../utils/dates';
import { getDayBoundariesInTz } from '../../utils/timezone';

type CalendarTab = 'today' | 'week' | 'upcoming' | 'past';

export default function CalendarScreen() {
  const { colors, isDark } = useTheme();
  const { sync, isSyncing } = useCalendarSync();

  const [activeTab, setActiveTab] = useState<CalendarTab>('today');
  const [selectedSource, setSelectedSource] = useState<MeetingSource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const configureAlarms = useConfigureMeetingAlarms();
  const [activeMeetingForAlarm, setActiveMeetingForAlarm] =
    useState<MeetingWithAlarms | null>(null);

  // Compute date range based on active tab
  const { startIso, endIso } = useMemo(() => {
    const now = new Date();
    if (activeTab === 'today') {
      return getDayBoundariesInTz(now);
    }
    if (activeTab === 'week') {
      return getDayBoundariesInTz(selectedDate);
    }
    if (activeTab === 'upcoming') {
      return {
        startIso: now.toISOString(),
        endIso: addDays(now, 90).toISOString(),
      };
    }
    // 'past'
    return {
      startIso: subDays(now, 90).toISOString(),
      endIso: now.toISOString(),
    };
  }, [activeTab, selectedDate]);

  // Query filtered meetings
  const filterOptions = useMemo(() => {
    return {
      sources: selectedSource !== 'all' ? [selectedSource] : undefined,
    };
  }, [selectedSource]);

  const {
    data: rangeMeetings = [],
    isLoading: isLoadingRange,
    refetch: refetchRange,
  } = useDateRangeMeetings(startIso, endIso, filterOptions);

  const {
    data: searchResults = [],
    isLoading: isLoadingSearch,
  } = useSearchMeetings(searchQuery);

  const isSearching = searchQuery.trim().length > 0;
  const displayMeetings = isSearching ? searchResults : rangeMeetings;
  const isLoading = isSearching ? isLoadingSearch : isLoadingRange;

  const weekDays = useMemo(() => getWeekDates(new Date()), []);

  const handleRefresh = async () => {
    await Promise.all([sync({ forceFullSync: true }), refetchRange()]);
  };

  const handleSaveAlarms = async (offsets: number[]) => {
    if (activeMeetingForAlarm) {
      await configureAlarms.mutateAsync({
        meeting: activeMeetingForAlarm,
        offsetMinutesList: offsets,
      });
      await refetchRange();
      setActiveMeetingForAlarm(null);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <Header title="Calendar" subtitle="All meetings & schedules" showSyncIndicator />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.surfaceBorder,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={colors.textMuted}
            style={{ marginRight: 8 }}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search meetings by title, notes, location..."
            placeholderTextColor={colors.textSubtle}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {!isSearching && (
        <>
          {/* View Mode Tabs */}
          <View style={styles.tabsRow}>
            {(['today', 'week', 'upcoming', 'past'] as CalendarTab[]).map(
              (tab) => {
                const isActive = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[
                      styles.tabButton,
                      isActive && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        {
                          color: isActive ? '#FFFFFF' : colors.textMuted,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {tab.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>

          {/* Week Date Strip when in 'week' view */}
          {activeTab === 'week' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateStrip}
            >
              {weekDays.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                const isCurrentToday = isSameDay(date, new Date());
                return (
                  <TouchableOpacity
                    key={date.toISOString()}
                    onPress={() => setSelectedDate(date)}
                    style={[
                      styles.datePill,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : colors.surface,
                        borderColor: isCurrentToday
                          ? colors.primary
                          : colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.datePillDay,
                        {
                          color: isSelected ? '#FFFFFF' : colors.textMuted,
                        },
                      ]}
                    >
                      {format(date, 'EEE')}
                    </Text>
                    <Text
                      style={[
                        styles.datePillNum,
                        {
                          color: isSelected ? '#FFFFFF' : colors.text,
                        },
                      ]}
                    >
                      {format(date, 'd')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Source Filter Pills */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
              Source:
            </Text>
            {(['all', 'google_calendar', 'imported'] as const).map((source) => {
              const isSelected = selectedSource === source;
              return (
                <TouchableOpacity
                  key={source}
                  onPress={() => setSelectedSource(source)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isSelected
                        ? colors.primaryLight
                        : colors.surfaceSubtle,
                      borderColor: isSelected
                        ? colors.primary
                        : colors.surfaceBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      {
                        color: isSelected ? colors.primary : colors.textMuted,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {source === 'all'
                      ? 'All'
                      : source === 'google_calendar'
                      ? 'Google Calendar'
                      : 'Imported'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Meetings List */}
      <MeetingList
        meetings={displayMeetings}
        isLoading={isLoading}
        isRefreshing={isSyncing}
        onRefresh={handleRefresh}
        emptyTitle={
          isSearching
            ? 'No search results'
            : activeTab === 'today'
            ? 'No meetings today'
            : activeTab === 'week'
            ? 'No meetings for this day'
            : activeTab === 'upcoming'
            ? 'No upcoming meetings'
            : 'No past meetings'
        }
        emptyDescription={
          isSearching
            ? `No meetings matched "${searchQuery}"`
            : 'Scheduled meetings and alarms will appear here.'
        }
        onAlarmPress={(m) => setActiveMeetingForAlarm(m)}
      />

      {/* Alarm Modal */}
      {activeMeetingForAlarm && (
        <AlarmSelector
          visible={!!activeMeetingForAlarm}
          meetingTitle={activeMeetingForAlarm.title}
          initialOffsets={activeMeetingForAlarm.alarms
            .filter((a) => a.isEnabled)
            .map((a) => a.offsetMinutes)}
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
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  dateStrip: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  datePill: {
    width: 48,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  datePillDay: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  datePillNum: {
    fontSize: 15,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 2,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11,
  },
});
