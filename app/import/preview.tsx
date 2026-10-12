import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  SpreadsheetParseResult,
  ColumnMapping,
  ParsedMeetingRow,
} from '../../types/import';
import {
  mapSpreadsheetRowsToMeetings,
  convertParsedRowsToMeetingInputs,
} from '../../services/imports/meeting.mapper';
import { MeetingsRepository } from '../../services/database/repositories/meetings.repository';
import { AlarmService } from '../../services/alarms/alarm.service';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../store/settings.store';
import { MEETINGS_QUERY_KEYS } from '../../hooks/useMeetings';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { formatAlarmOffsetLabel } from '../../constants/alarms';
import { formatInTz } from '../../utils/timezone';
import { logger } from '../../utils/logger';

export default function ImportPreviewScreen() {
  const { parseResult: parseResultJson, mapping: mappingJson } =
    useLocalSearchParams<{
      parseResult: string;
      mapping: string;
    }>();

  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { settings } = useSettingsStore();

  const [isImporting, setIsImporting] = useState(false);
  const [defaultBatchAlarmOffset, setDefaultBatchAlarmOffset] = useState<number>(
    settings.defaultAlarmOffsets[0] || 15
  );

  const parseResult: SpreadsheetParseResult = useMemo(() => {
    try {
      return JSON.parse(parseResultJson);
    } catch {
      return {
        fileName: '',
        sheetNames: [],
        activeSheet: '',
        headers: [],
        rawRows: [],
        suggestedMapping: { title: '', date: '', startTime: '' },
      };
    }
  }, [parseResultJson]);

  const mapping: ColumnMapping = useMemo(() => {
    try {
      return JSON.parse(mappingJson);
    } catch {
      return { title: '', date: '', startTime: '' };
    }
  }, [mappingJson]);

  // Map and validate rows
  const [rows, setRows] = useState<ParsedMeetingRow[]>(() => {
    return mapSpreadsheetRowsToMeetings(parseResult.rawRows, mapping, {
      timezone: settings.defaultTimezone,
      defaultAlarmOffsetMinutes: defaultBatchAlarmOffset,
      defaultDurationMinutes: settings.defaultMeetingDurationMinutes,
    });
  });

  const validRows = rows.filter((r) => r.status === 'valid');
  const warningRows = rows.filter((r) => r.status === 'warning');
  const errorRows = rows.filter((r) => r.status === 'error');
  const selectedCount = rows.filter((r) => r.isSelected && r.status !== 'error').length;

  const handleToggleRow = (rowIndex: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.rowIndex === rowIndex ? { ...r, isSelected: !r.isSelected } : r
      )
    );
  };

  const handleToggleSelectAll = () => {
    const shouldSelectAll = selectedCount < validRows.length + warningRows.length;
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        isSelected: r.status !== 'error' && shouldSelectAll,
      }))
    );
  };

  const handleApplyBatchAlarm = (offset: number) => {
    setDefaultBatchAlarmOffset(offset);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        alarmOffsetMinutes: offset,
      }))
    );
  };

  const handleExecuteImport = async () => {
    if (selectedCount === 0) {
      Alert.alert('No Meetings Selected', 'Please select at least one valid meeting to import.');
      return;
    }

    setIsImporting(true);
    try {
      logger.info(`Starting batch import of ${selectedCount} meetings...`);
      const inputs = convertParsedRowsToMeetingInputs(
        rows,
        settings.defaultTimezone
      );

      // 1. Batch insert into SQLite
      const meetingsToInsert = inputs.map((item) => item.meeting);
      const insertedMeetings =
        await MeetingsRepository.batchInsertImportedMeetings(meetingsToInsert);

      // 2. Schedule local alarms for each inserted meeting
      let scheduledAlarmsCount = 0;
      for (let i = 0; i < insertedMeetings.length; i++) {
        const meeting = insertedMeetings[i];
        const offset = inputs[i]?.alarmOffsetMinutes ?? defaultBatchAlarmOffset;

        if (settings.enableNotifications && offset >= 0) {
          const alarms = await AlarmService.configureMeetingAlarms(
            meeting,
            [offset]
          );
          scheduledAlarmsCount += alarms.length;
        }
      }

      logger.info(
        `Imported ${insertedMeetings.length} meetings and scheduled ${scheduledAlarmsCount} alarms`
      );

      // 3. Invalidate TanStack query caches
      await queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEYS.all });

      Alert.alert(
        'Import Successful',
        `Successfully imported ${insertedMeetings.length} meeting(s) and scheduled ${scheduledAlarmsCount} alarm(s).`,
        [
          {
            text: 'View in Dashboard',
            onPress: () => {
              router.dismissAll();
              router.replace('/(tabs)/dashboard');
            },
          },
        ]
      );
    } catch (err) {
      logger.error('Failed to execute meeting import', err);
      Alert.alert(
        'Import Failed',
        err instanceof Error ? err.message : 'An error occurred while importing meetings'
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Top Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Preview Meetings
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Stats Banner */}
        <Card style={styles.summaryCard}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            {rows.length} Meetings Found
          </Text>
          <View style={styles.statPillsRow}>
            <View
              style={[
                styles.statPill,
                { backgroundColor: colors.successLight },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={colors.success}
              />
              <Text style={[styles.statPillText, { color: colors.success }]}>
                {validRows.length} Valid
              </Text>
            </View>

            {warningRows.length > 0 && (
              <View
                style={[
                  styles.statPill,
                  { backgroundColor: colors.warningLight },
                ]}
              >
                <Ionicons name="warning" size={14} color={colors.warning} />
                <Text style={[styles.statPillText, { color: colors.warning }]}>
                  {warningRows.length} Warnings
                </Text>
              </View>
            )}

            {errorRows.length > 0 && (
              <View
                style={[
                  styles.statPill,
                  { backgroundColor: colors.dangerLight },
                ]}
              >
                <Ionicons name="close-circle" size={14} color={colors.danger} />
                <Text style={[styles.statPillText, { color: colors.danger }]}>
                  {errorRows.length} Invalid
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Global Alarm Preset for Imported Batch */}
        <View style={styles.batchAlarmSection}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            SET ALARM FOR THIS IMPORT
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.alarmChipsRow}
          >
            {[0, 5, 10, 15, 30, 60].map((mins) => {
              const isSelected = defaultBatchAlarmOffset === mins;
              return (
                <TouchableOpacity
                  key={mins}
                  onPress={() => handleApplyBatchAlarm(mins)}
                  style={[
                    styles.batchAlarmChip,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.surfaceSubtle,
                      borderColor: isSelected
                        ? colors.primary
                        : colors.surfaceBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="notifications"
                    size={12}
                    color={isSelected ? '#FFFFFF' : colors.primary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.batchAlarmChipText,
                      {
                        color: isSelected ? '#FFFFFF' : colors.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {formatAlarmOffsetLabel(mins)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* List Header: Select All Toggle */}
        <View style={styles.listHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            SELECT MEETINGS TO IMPORT ({selectedCount}/{rows.length})
          </Text>
          <TouchableOpacity
            onPress={handleToggleSelectAll}
            style={styles.selectAllBtn}
          >
            <Text style={[styles.selectAllText, { color: colors.primary }]}>
              {selectedCount === validRows.length + warningRows.length
                ? 'Deselect All'
                : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Parsed Rows Cards */}
        <View style={styles.rowsList}>
          {rows.map((row) => {
            const isError = row.status === 'error';
            const isWarning = row.status === 'warning';

            return (
              <Card
                key={row.rowIndex}
                style={[
                  styles.previewCard,
                  {
                    borderColor: isError
                      ? colors.dangerBorder
                      : row.isSelected
                      ? colors.primary
                      : colors.cardBorder,
                    opacity: isError ? 0.65 : 1,
                  },
                ]}
              >
                <View style={styles.previewCardHeader}>
                  <TouchableOpacity
                    onPress={() => !isError && handleToggleRow(row.rowIndex)}
                    disabled={isError}
                    style={styles.checkboxContainer}
                  >
                    <Ionicons
                      name={
                        isError
                          ? 'ban'
                          : row.isSelected
                          ? 'checkbox'
                          : 'square-outline'
                      }
                      size={22}
                      color={
                        isError
                          ? colors.danger
                          : row.isSelected
                          ? colors.primary
                          : colors.textMuted
                      }
                    />
                  </TouchableOpacity>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text
                      style={[styles.previewTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {row.title}
                    </Text>
                    <Text
                      style={[
                        styles.previewTime,
                        { color: colors.textMuted },
                      ]}
                    >
                      {row.computedStartIso
                        ? `${formatInTz(row.computedStartIso, 'MMM d, yyyy')} • ${formatInTz(row.computedStartIso, 'h:mm a')}`
                        : `${row.date} ${row.startTime}`}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isError
                          ? colors.dangerLight
                          : isWarning
                          ? colors.warningLight
                          : colors.successLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: isError
                            ? colors.danger
                            : isWarning
                            ? colors.warning
                            : colors.success,
                        },
                      ]}
                    >
                      {row.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Alarm Pill */}
                <View style={styles.previewDetailsRow}>
                  <View
                    style={[
                      styles.alarmDetailPill,
                      { backgroundColor: colors.surfaceSubtle },
                    ]}
                  >
                    <Ionicons
                      name="notifications"
                      size={12}
                      color={colors.primary}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[styles.alarmDetailText, { color: colors.primary }]}
                    >
                      🔔 {formatAlarmOffsetLabel(row.alarmOffsetMinutes || 15)}
                    </Text>
                  </View>

                  {row.meetingUrl && (
                    <View
                      style={[
                        styles.alarmDetailPill,
                        { backgroundColor: colors.infoLight },
                      ]}
                    >
                      <Ionicons
                        name="videocam"
                        size={12}
                        color={colors.info}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[styles.alarmDetailText, { color: colors.info }]}
                        numberOfLines={1}
                      >
                        Link attached
                      </Text>
                    </View>
                  )}
                </View>

                {/* Validation Errors/Warnings */}
                {row.errors.length > 0 && (
                  <View
                    style={[
                      styles.errorBox,
                      { backgroundColor: colors.dangerLight },
                    ]}
                  >
                    {row.errors.map((err, i) => (
                      <Text
                        key={i}
                        style={[styles.errorItemText, { color: colors.danger }]}
                      >
                        • {err}
                      </Text>
                    ))}
                  </View>
                )}

                {row.warnings.length > 0 && (
                  <View
                    style={[
                      styles.warningBox,
                      { backgroundColor: colors.warningLight },
                    ]}
                  >
                    {row.warnings.map((warn, i) => (
                      <Text
                        key={i}
                        style={[
                          styles.warningItemText,
                          { color: colors.warning },
                        ]}
                      >
                        ⚠️ {warn}
                      </Text>
                    ))}
                  </View>
                )}
              </Card>
            );
          })}
        </View>

        {/* Import Action CTA */}
        <Button
          title={`Import ${selectedCount} Meeting(s)`}
          onPress={handleExecuteImport}
          isLoading={isImporting}
          variant="primary"
          size="lg"
          icon="cloud-download"
          style={styles.importBtn}
        />
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    padding: 16,
    marginVertical: 10,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  statPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  batchAlarmSection: {
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  alarmChipsRow: {
    gap: 6,
    paddingBottom: 4,
  },
  batchAlarmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  batchAlarmChipText: {
    fontSize: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },
  selectAllBtn: {
    padding: 4,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowsList: {
    gap: 10,
  },
  previewCard: {
    padding: 12,
    borderWidth: 1.5,
  },
  previewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    padding: 2,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewTime: {
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  previewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  alarmDetailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alarmDetailText: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorBox: {
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  errorItemText: {
    fontSize: 11,
    lineHeight: 15,
  },
  warningBox: {
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  warningItemText: {
    fontSize: 11,
    lineHeight: 15,
  },
  importBtn: {
    marginTop: 20,
    width: '100%',
  },
});
