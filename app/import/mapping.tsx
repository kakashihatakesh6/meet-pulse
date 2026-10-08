import React, { useState } from 'react';
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
import {
  SpreadsheetParseResult,
  ColumnMapping,
} from '../../types/import';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';

interface MappingFieldConfig {
  key: keyof ColumnMapping;
  label: string;
  required: boolean;
  description: string;
}

const MAPPING_FIELDS: MappingFieldConfig[] = [
  {
    key: 'title',
    label: 'Meeting Title / Name',
    required: true,
    description: 'Name or subject of the meeting',
  },
  {
    key: 'date',
    label: 'Date',
    required: true,
    description: 'Meeting date (e.g. 2026-09-25, 09/25/2026)',
  },
  {
    key: 'startTime',
    label: 'Start Time',
    required: true,
    description: 'Time when meeting starts (e.g. 10:00 AM, 14:30)',
  },
  {
    key: 'endTime',
    label: 'End Time',
    required: false,
    description: 'Time when meeting finishes (e.g. 11:00 AM)',
  },
  {
    key: 'duration',
    label: 'Duration',
    required: false,
    description: 'Length in minutes or hours (e.g. 30m, 1h)',
  },
  {
    key: 'meetingUrl',
    label: 'Meeting Link / URL',
    required: false,
    description: 'Google Meet, Zoom, Teams, or conference link',
  },
  {
    key: 'description',
    label: 'Description / Notes',
    required: false,
    description: 'Agenda, notes, or details',
  },
  {
    key: 'location',
    label: 'Location / Room',
    required: false,
    description: 'Physical room or conference room',
  },
  {
    key: 'alarmOffset',
    label: 'Alarm Reminder (mins)',
    required: false,
    description: 'Reminder offset before start (e.g. 15)',
  },
];

export default function ColumnMappingScreen() {
  const { parseResult: parseResultJson } = useLocalSearchParams<{
    parseResult: string;
  }>();
  const router = useRouter();
  const { colors } = useTheme();

  const parseResult: SpreadsheetParseResult = React.useMemo(() => {
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

  const [mapping, setMapping] = useState<ColumnMapping>(
    parseResult.suggestedMapping
  );

  const handleSelectColumn = (fieldKey: keyof ColumnMapping, header: string) => {
    setMapping((prev) => ({
      ...prev,
      [fieldKey]: prev[fieldKey] === header ? '' : header,
    }));
  };

  const handleProceedToPreview = () => {
    if (!mapping.title) {
      Alert.alert('Required Field', 'Please map a column for Meeting Title.');
      return;
    }
    if (!mapping.date) {
      Alert.alert('Required Field', 'Please map a column for Meeting Date.');
      return;
    }
    if (!mapping.startTime) {
      Alert.alert('Required Field', 'Please map a column for Start Time.');
      return;
    }

    router.push({
      pathname: '/import/preview',
      params: {
        parseResult: JSON.stringify(parseResult),
        mapping: JSON.stringify(mapping),
      },
    });
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
          Map Columns
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.fileInfoBox}>
          <Ionicons name="document-text" size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.fileName, { color: colors.text }]}>
              {parseResult.fileName}
            </Text>
            <Text style={[styles.fileStats, { color: colors.textMuted }]}>
              {parseResult.rawRows.length} rows found • Sheet: {parseResult.activeSheet}
            </Text>
          </View>
        </View>

        <Text style={[styles.instructions, { color: colors.textMuted }]}>
          Match your spreadsheet columns to Meeting Alarm fields:
        </Text>

        {/* Mapping Fields List */}
        <View style={styles.fieldsList}>
          {MAPPING_FIELDS.map((field) => {
            const mappedHeader = mapping[field.key];
            return (
              <Card key={field.key} style={styles.fieldCard}>
                <View style={styles.fieldHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                      {field.label}
                    </Text>
                    {field.required && (
                      <Text style={[styles.requiredStar, { color: colors.danger }]}>
                        *
                      </Text>
                    )}
                  </View>
                  {mappedHeader ? (
                    <View
                      style={[
                        styles.mappedBadge,
                        { backgroundColor: colors.primaryLight },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={12}
                        color={colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[styles.mappedBadgeText, { color: colors.primary }]}
                      >
                        {mappedHeader}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={[styles.unmappedText, { color: colors.textSubtle }]}
                    >
                      (Unmapped)
                    </Text>
                  )}
                </View>

                <Text style={[styles.fieldDesc, { color: colors.textMuted }]}>
                  {field.description}
                </Text>

                {/* Available Spreadsheet Columns Chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsContainer}
                >
                  {parseResult.headers.map((header) => {
                    const isSelected = mappedHeader === header;
                    return (
                      <TouchableOpacity
                        key={header}
                        onPress={() => handleSelectColumn(field.key, header)}
                        style={[
                          styles.colChip,
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
                        <Text
                          style={[
                            styles.colChipText,
                            {
                              color: isSelected ? '#FFFFFF' : colors.text,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {header}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </Card>
            );
          })}
        </View>

        {/* Proceed Button */}
        <Button
          title="Preview Meetings →"
          onPress={handleProceedToPreview}
          variant="primary"
          size="lg"
          style={styles.proceedBtn}
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
  fileInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginVertical: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
  },
  fileStats: {
    fontSize: 12,
    marginTop: 2,
  },
  instructions: {
    fontSize: 13,
    marginBottom: 12,
  },
  fieldsList: {
    gap: 10,
  },
  fieldCard: {
    padding: 14,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  requiredStar: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 2,
  },
  mappedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mappedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  unmappedText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  fieldDesc: {
    fontSize: 12,
    marginBottom: 10,
  },
  chipsContainer: {
    gap: 6,
  },
  colChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  colChipText: {
    fontSize: 12,
  },
  proceedBtn: {
    marginTop: 20,
    width: '100%',
  },
});
