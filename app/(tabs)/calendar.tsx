import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  subDays,
  addDays,
  isSameDay,
  isSameWeek,
} from 'date-fns';
import { useDateRangeMeetings, useSearchMeetings } from '../../hooks/useMeetings';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useConfigureMeetingAlarms } from '../../hooks/useAlarms';
import { useTheme } from '../../hooks/useTheme';
import { Header } from '../../components/Header';
import { MeetingList } from '../../components/MeetingList';
import { AlarmSelector } from '../../components/AlarmSelector';
import { MeetingWithAlarms, MeetingSource } from '../../types/meeting';
import { useAuthStore } from '../../store/auth.store';
import { getWeekDates } from '../../utils/dates';
import { getDayBoundariesInTz, getWeekBoundariesInTz, formatInTz, getDeviceTimezone } from '../../utils/timezone';

type CalendarTab = 'today' | 'week' | 'upcoming' | 'past';
type StatusFilter = 'all' | 'upcoming' | 'completed';

export default function CalendarScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const { sync, isSyncing } = useCalendarSync();

  const [activeTab, setActiveTab] = useState<CalendarTab>('today');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [selectedSource, setSelectedSource] = useState<MeetingSource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Week view state
  const [currentWeekBaseDate, setCurrentWeekBaseDate] = useState<Date>(new Date());
  const [selectedWeekDay, setSelectedWeekDay] = useState<Date | null>(null);

  const configureAlarms = useConfigureMeetingAlarms();
  const [activeMeetingForAlarm, setActiveMeetingForAlarm] =
    useState<MeetingWithAlarms | null>(null);

  // Auto-sync on initial mount if authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      sync({ forceFullSync: true });
    }
  }, [isAuthenticated, sync]);

  // Compute date range based on active tab
  const { startIso, endIso } = useMemo(() => {
    const now = new Date();
    if (activeTab === 'today') {
      return getDayBoundariesInTz(now);
    }
    if (activeTab === 'week') {
      if (selectedWeekDay) {
        return getDayBoundariesInTz(selectedWeekDay);
      }
      return getWeekBoundariesInTz(currentWeekBaseDate);
    }
    if (activeTab === 'upcoming') {
      return {
        startIso: now.toISOString(),
        endIso: addDays(now, 365).toISOString(),
      };
    }
    if (activeTab === 'past') {
      return {
        startIso: '1970-01-01T00:00:00.000Z',
        endIso: now.toISOString(),
      };
    }
    return getDayBoundariesInTz(now);
  }, [activeTab, selectedWeekDay, currentWeekBaseDate]);

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

  // Status breakdown counts
  const statusCounts = useMemo(() => {
    let upcoming = 0;
    let completed = 0;
    for (const m of rangeMeetings) {
      if (m.status === 'upcoming' || m.status === 'in_progress') {
        upcoming++;
      } else if (m.status === 'completed') {
        completed++;
      }
    }
    return {
      all: rangeMeetings.length,
      upcoming,
      completed,
    };
  }, [rangeMeetings]);

  // Filter by status (real-time computed)
  const filteredMeetings = useMemo(() => {
    let list = rangeMeetings;
    if (selectedStatus === 'upcoming') {
      list = rangeMeetings.filter(
        (m) => m.status === 'upcoming' || m.status === 'in_progress'
      );
    } else if (selectedStatus === 'completed') {
      list = rangeMeetings.filter((m) => m.status === 'completed');
    }

    if (activeTab === 'past') {
      // Sort past meetings descending (most recent first)
      return [...list].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    }

    return list;
  }, [rangeMeetings, selectedStatus, activeTab]);

  // Refetch meetings when calendar screen gains focus
  useFocusEffect(
    useCallback(() => {
      refetchRange();
    }, [refetchRange])
  );

  const {
    data: searchResults = [],
    isLoading: isLoadingSearch,
  } = useSearchMeetings(searchQuery);

  const isSearching = searchQuery.trim().length > 0;
  const displayMeetings = isSearching ? searchResults : filteredMeetings;
  const isLoading = isSearching ? isLoadingSearch : isLoadingRange;

  const weekDays = useMemo(() => getWeekDates(currentWeekBaseDate), [currentWeekBaseDate]);

  const isCurrentWeek = useMemo(() => {
    return isSameWeek(currentWeekBaseDate, new Date(), { weekStartsOn: 1 });
  }, [currentWeekBaseDate]);

  const handlePrevWeek = () => {
    setCurrentWeekBaseDate((prev) => subDays(prev, 7));
  };

  const handleNextWeek = () => {
    setCurrentWeekBaseDate((prev) => addDays(prev, 7));
  };

  const handleResetToThisWeek = () => {
    setCurrentWeekBaseDate(new Date());
    setSelectedWeekDay(null);
  };

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

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length < 7) return '';
    const startStr = formatInTz(weekDays[0].toISOString(), 'MMM d');
    const endStr = formatInTz(weekDays[6].toISOString(), 'MMM d, yyyy');
    return `${startStr} – ${endStr}`;
  }, [weekDays]);

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
                    onPress={() => {
                      setActiveTab(tab);
                    }}
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

          {/* Week Controls when in 'week' view */}
          {activeTab === 'week' && (
            <View style={styles.weekSection}>
              {/* Week Navigator Header */}
              <View style={styles.weekNavRow}>
                <TouchableOpacity
                  onPress={handlePrevWeek}
                  style={[styles.navArrowBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.surfaceBorder }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={16} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.weekRangeContainer}>
                  <Text style={[styles.weekRangeText, { color: colors.text }]}>
                    {weekRangeLabel}
                  </Text>
                  {!isCurrentWeek && (
                    <TouchableOpacity
                      onPress={handleResetToThisWeek}
                      style={[styles.thisWeekBadge, { backgroundColor: colors.primaryLight }]}
                    >
                      <Text style={[styles.thisWeekBadgeText, { color: colors.primary }]}>
                        This Week
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleNextWeek}
                  style={[styles.navArrowBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.surfaceBorder }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Week Date Strip */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateStrip}
              >
                {/* "All Week" Pill */}
                <TouchableOpacity
                  onPress={() => setSelectedWeekDay(null)}
                  style={[
                    styles.allWeekPill,
                    {
                      backgroundColor: selectedWeekDay === null
                        ? colors.primary
                        : colors.surface,
                      borderColor: selectedWeekDay === null
                        ? colors.primary
                        : colors.surfaceBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar"
                    size={14}
                    color={selectedWeekDay === null ? '#FFFFFF' : colors.textMuted}
                    style={{ marginBottom: 2 }}
                  />
                  <Text
                    style={[
                      styles.allWeekPillText,
                      {
                        color: selectedWeekDay === null ? '#FFFFFF' : colors.text,
                        fontWeight: selectedWeekDay === null ? '700' : '600',
                      },
                    ]}
                  >
                    All Week
                  </Text>
                </TouchableOpacity>

                {/* 7 Day Pills */}
                {weekDays.map((date) => {
                  const isSelected = selectedWeekDay ? isSameDay(date, selectedWeekDay) : false;
                  const isCurrentToday = isSameDay(date, new Date());
                  return (
                    <TouchableOpacity
                      key={date.toISOString()}
                      onPress={() => {
                        if (selectedWeekDay && isSameDay(date, selectedWeekDay)) {
                          setSelectedWeekDay(null); // Toggle back to all week
                        } else {
                          setSelectedWeekDay(date);
                        }
                      }}
                      style={[
                        styles.datePill,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : colors.surface,
                          borderColor: isSelected
                            ? colors.primary
                            : isCurrentToday
                            ? colors.primary
                            : colors.surfaceBorder,
                          borderWidth: isCurrentToday ? 1.5 : 1,
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
                        {formatInTz(date.toISOString(), 'EEE')}
                      </Text>
                      <Text
                        style={[
                          styles.datePillNum,
                          {
                            color: isSelected ? '#FFFFFF' : colors.text,
                          },
                        ]}
                      >
                        {formatInTz(date.toISOString(), 'd')}
                      </Text>
                      {isCurrentToday && !isSelected && (
                        <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Status & Source Filter Rows */}
          <View style={styles.filterSection}>
            {/* Status Filter Pills */}
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
                Status:
              </Text>
              {(
                [
                  { key: 'all', label: 'All', count: statusCounts.all },
                  { key: 'upcoming', label: 'Upcoming', count: statusCounts.upcoming },
                  { key: 'completed', label: 'Ended', count: statusCounts.completed },
                ] as const
              ).map((item) => {
                const isSelected = selectedStatus === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setSelectedStatus(item.key)}
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
                      {item.label} ({item.count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

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
          </View>

          {/* Today Quick Overview Bar */}
          {activeTab === 'today' && rangeMeetings.length > 0 && (
            <View
              style={[
                styles.todayOverviewBar,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.surfaceBorder,
                },
              ]}
            >
              <Ionicons
                name="calendar"
                size={14}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.todayOverviewText, { color: colors.text }]}>
                <Text style={{ fontWeight: '700' }}>
                  {rangeMeetings.length} Meeting{rangeMeetings.length === 1 ? '' : 's'} Today
                </Text>
                {statusCounts.completed > 0 && ` • ${statusCounts.completed} ended`}
                {statusCounts.upcoming > 0 && ` • ${statusCounts.upcoming} upcoming`}
              </Text>
            </View>
          )}
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
            : selectedStatus === 'completed'
            ? 'No ended meetings'
            : selectedStatus === 'upcoming'
            ? 'No upcoming meetings'
            : activeTab === 'today'
            ? 'No meetings today'
            : activeTab === 'week'
            ? selectedWeekDay
              ? `No meetings on ${formatInTz(selectedWeekDay.toISOString(), 'EEEE, MMM d')}`
              : 'No meetings this week'
            : activeTab === 'upcoming'
            ? 'No upcoming meetings'
            : activeTab === 'past'
            ? 'No past meetings'
            : 'No meetings found'
        }
        emptyDescription={
          isSearching
            ? `No meetings matched "${searchQuery}"`
            : selectedStatus === 'completed'
            ? 'There are no past or ended meetings for this selection.'
            : selectedStatus === 'upcoming'
            ? 'There are no upcoming meetings for this selection.'
            : activeTab === 'today'
            ? 'You have a clear schedule for today.'
            : activeTab === 'week'
            ? 'Scheduled meetings for this period will appear here.'
            : activeTab === 'past'
            ? 'No past meetings found in your calendar.'
            : activeTab === 'upcoming'
            ? 'No upcoming meetings scheduled.'
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
    marginBottom: 8,
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
  weekSection: {
    marginBottom: 6,
  },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekRangeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  thisWeekBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  thisWeekBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dateStrip: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  allWeekPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minWidth: 64,
  },
  allWeekPillText: {
    fontSize: 11,
  },
  datePill: {
    width: 48,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
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
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  filterSection: {
    gap: 6,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 6,
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
  todayOverviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  todayOverviewText: {
    fontSize: 12,
  },
});
