import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  GoogleSheetsService,
  GoogleSpreadsheetMetadata,
} from '../../services/google/sheets';
import { suggestColumnMapping } from '../../services/imports/meeting.mapper';
import { GoogleDriveSpreadsheet, SpreadsheetParseResult } from '../../types/import';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SheetsPickerSkeleton } from '../../components/Skeleton';
import { formatInTz } from '../../utils/timezone';
import { logger } from '../../utils/logger';

export default function GoogleSheetsPickerScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [spreadsheets, setSpreadsheets] = useState<GoogleDriveSpreadsheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSheetMetadata, setSelectedSheetMetadata] =
    useState<GoogleSpreadsheetMetadata | null>(null);
  const [isFetchingValues, setIsFetchingValues] = useState(false);

  useEffect(() => {
    async function loadSpreadsheets() {
      try {
        setIsLoading(true);
        const files = await GoogleSheetsService.listUserSpreadsheets();
        setSpreadsheets(files);
      } catch (err) {
        logger.error('Failed to list Google Spreadsheets', err);
        Alert.alert(
          'Error',
          'Failed to load spreadsheets from Google Drive. Please ensure you have granted Drive permissions.'
        );
      } finally {
        setIsLoading(false);
      }
    }
    loadSpreadsheets();
  }, []);

  const handleSelectSpreadsheet = async (sheetFile: GoogleDriveSpreadsheet) => {
    setIsFetchingValues(true);
    try {
      const meta = await GoogleSheetsService.getSpreadsheetMetadata(sheetFile.id);
      if (meta.sheets.length === 1) {
        // Only 1 tab -> fetch values immediately
        await handleSelectTab(sheetFile.id, sheetFile.name, meta.sheets[0].title);
      } else {
        setSelectedSheetMetadata(meta);
      }
    } catch (err) {
      logger.error('Failed to get spreadsheet metadata', err);
      Alert.alert('Error', 'Unable to inspect spreadsheet sheets.');
    } finally {
      setIsFetchingValues(false);
    }
  };

  const handleSelectTab = async (
    spreadsheetId: string,
    spreadsheetTitle: string,
    tabTitle: string
  ) => {
    setIsFetchingValues(true);
    try {
      const { headers, rows } = await GoogleSheetsService.getSheetValues(
        spreadsheetId,
        tabTitle
      );

      if (rows.length === 0) {
        Alert.alert('Empty Sheet', `No data rows found in worksheet "${tabTitle}".`);
        return;
      }

      const parseResult: SpreadsheetParseResult = {
        fileName: `${spreadsheetTitle} - ${tabTitle}`,
        sheetNames: selectedSheetMetadata?.sheets.map((s) => s.title) || [tabTitle],
        activeSheet: tabTitle,
        headers,
        rawRows: rows,
        suggestedMapping: suggestColumnMapping(headers),
      };

      router.push({
        pathname: '/import/mapping',
        params: {
          parseResult: JSON.stringify(parseResult),
        },
      });
    } catch (err) {
      logger.error('Failed to fetch sheet values', err);
      Alert.alert('Error', 'Failed to read rows from Google Sheet.');
    } finally {
      setIsFetchingValues(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => {
            if (selectedSheetMetadata) {
              setSelectedSheetMetadata(null);
            } else {
              router.back();
            }
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {selectedSheetMetadata
            ? selectedSheetMetadata.title
            : 'Select Google Sheet'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <SheetsPickerSkeleton />
      ) : isFetchingValues ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading spreadsheet contents...
          </Text>
        </View>
      ) : selectedSheetMetadata ? (
        <View style={styles.content}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            SELECT WORKSHEET TAB
          </Text>
          {selectedSheetMetadata.sheets.map((tab) => (
            <TouchableOpacity
              key={tab.sheetId}
              activeOpacity={0.7}
              onPress={() =>
                handleSelectTab(
                  selectedSheetMetadata.spreadsheetId,
                  selectedSheetMetadata.title,
                  tab.title
                )
              }
            >
              <Card style={styles.tabCard}>
                <Ionicons name="grid-outline" size={20} color={colors.accent} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.tabTitle, { color: colors.text }]}>
                    {tab.title}
                  </Text>
                  <Text style={[styles.tabStats, { color: colors.textMuted }]}>
                    ~{tab.rowCount} rows
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList
          data={spreadsheets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => handleSelectSpreadsheet(item)}
            >
              <Card style={styles.sheetCard}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: colors.accentLight },
                  ]}
                >
                  <Ionicons name="grid" size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text
                    style={[styles.sheetName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.modifiedTime && (
                    <Text
                      style={[styles.modifiedTime, { color: colors.textMuted }]}
                    >
                      Modified: {formatInTz(item.modifiedTime, 'MMM d, yyyy')}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="grid-outline"
              title="No Google Sheets Found"
              description="We could not find any Google Spreadsheets in your Google Drive."
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  tabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
  },
  tabTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  tabStats: {
    fontSize: 12,
    marginTop: 2,
  },
  listContainer: {
    padding: 16,
  },
  sheetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sheetName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  modifiedTime: {
    fontSize: 11,
  },
});
