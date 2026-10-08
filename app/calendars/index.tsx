import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CalendarsRepository } from '../../services/database/repositories/calendars.repository';
import { GoogleCalendarService } from '../../services/google/calendar';
import { CalendarEntity } from '../../types/calendar';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useTheme } from '../../hooks/useTheme';
import { CalendarCard } from '../../components/CalendarCard';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Button } from '../../components/Button';
import { logger } from '../../utils/logger';

export default function CalendarsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { sync, isSyncing } = useCalendarSync();

  const [calendars, setCalendars] = useState<CalendarEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCalendars = async () => {
    setIsLoading(true);
    try {
      // 1. Load from local DB
      const localCals = await CalendarsRepository.getAll();
      setCalendars(localCals);

      // 2. Fetch fresh list from Google if available
      try {
        const remoteCals = await GoogleCalendarService.fetchCalendarList();
        if (remoteCals.length > 0) {
          const updated = await CalendarsRepository.batchUpsert(remoteCals);
          setCalendars(updated);
        }
      } catch (err) {
        logger.warn('Could not refresh remote calendar list, using local data', err);
      }
    } catch (err) {
      logger.error('Failed to load calendars', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalendars();
  }, []);

  const handleToggleCalendar = async (id: string, isEnabled: boolean) => {
    setCalendars((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isEnabled } : c))
    );
    await CalendarsRepository.toggleEnabled(id, isEnabled);
    // Trigger sync for enabled calendars
    sync();
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Connected Calendars
        </Text>
        <TouchableOpacity
          onPress={() => {
            loadCalendars();
            sync();
          }}
          disabled={isSyncing}
          style={styles.refreshBtn}
        >
          <Ionicons
            name="sync"
            size={20}
            color={isSyncing ? colors.textMuted : colors.primary}
          />
        </TouchableOpacity>
      </View>

      <Text style={[styles.instructions, { color: colors.textMuted }]}>
        Toggle the calendars you want Meeting Alarm to monitor and schedule
        notifications for.
      </Text>

      {isLoading && calendars.length === 0 ? (
        <LoadingState count={3} />
      ) : (
        <FlatList
          data={calendars}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item }) => (
            <CalendarCard
              calendar={item}
              onToggle={handleToggleCalendar}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No Calendars Found"
              description="Sign in with Google or refresh to discover your calendars."
              actionLabel="Refresh Calendars"
              onAction={loadCalendars}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading || isSyncing}
              onRefresh={() => {
                loadCalendars();
                sync();
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
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
  refreshBtn: {
    padding: 6,
  },
  instructions: {
    fontSize: 13,
    paddingHorizontal: 16,
    marginBottom: 12,
    lineHeight: 18,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
});
