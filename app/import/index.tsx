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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ExcelParserService } from '../../services/imports/excel.parser';
import { useAuthStore } from '../../store/auth.store';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { logger } from '../../utils/logger';

export default function ImportIndexScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const handlePickDocument = async () => {
    setIsLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
          'text/csv', // .csv
          'text/comma-separated-values',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsLoading(false);
        return;
      }

      const file = result.assets[0];
      logger.info(`Picked file: ${file.name} (${file.size} bytes)`);

      const parsed = await ExcelParserService.parseSpreadsheetFile(
        file.uri,
        file.name
      );

      if (parsed.rawRows.length === 0) {
        Alert.alert(
          'Empty Spreadsheet',
          'The selected spreadsheet does not contain any data rows.'
        );
        setIsLoading(false);
        return;
      }

      // Navigate to Column Mapping with serialized data
      router.push({
        pathname: '/import/mapping',
        params: {
          parseResult: JSON.stringify(parsed),
        },
      });
    } catch (err) {
      logger.error('Error picking/parsing document', err);
      Alert.alert(
        'Import Error',
        err instanceof Error ? err.message : 'Failed to read spreadsheet file'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenGoogleSheets = () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Google Sign-In Required',
        'Please sign in with Google in Settings to import directly from Google Sheets.'
      );
      return;
    }
    router.push('/import/sheets');
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Import Meetings
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Choose Import Method
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Upload a spreadsheet schedule or connect directly to Google Sheets.
        </Text>

        {/* Upload Excel / CSV Card */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handlePickDocument}
          disabled={isLoading}
          style={[
            styles.methodCard,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.primary,
            },
          ]}
        >
          <View
            style={[
              styles.methodIcon,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Ionicons name="document-text" size={32} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.methodTitle, { color: colors.text }]}>
              Excel or CSV File
            </Text>
            <Text style={[styles.methodDesc, { color: colors.textMuted }]}>
              Select a .xlsx, .xls, or .csv file from your device storage or cloud drives.
            </Text>
          </View>
          <Ionicons
            name="cloud-upload-outline"
            size={22}
            color={colors.primary}
          />
        </TouchableOpacity>

        {/* Google Sheets Card */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleOpenGoogleSheets}
          style={[
            styles.methodCard,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <View
            style={[
              styles.methodIcon,
              { backgroundColor: colors.accentLight },
            ]}
          >
            <Ionicons name="grid" size={32} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.methodTitle, { color: colors.text }]}>
              Google Sheets
            </Text>
            <Text style={[styles.methodDesc, { color: colors.textMuted }]}>
              Browse and select a spreadsheet directly from your Google Drive.
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {/* Supported Columns Guide Card */}
        <Card style={styles.guideCard} variant="subtle">
          <View style={styles.guideHeader}>
            <Ionicons
              name="information-circle"
              size={20}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.guideTitle, { color: colors.text }]}>
              Supported Spreadsheet Columns
            </Text>
          </View>
          <Text style={[styles.guideText, { color: colors.textMuted }]}>
            Meeting Alarm automatically detects standard column headers. We
            support flexible naming conventions:
          </Text>

          <View style={styles.guideList}>
            <View style={styles.guideItem}>
              <Text style={[styles.colName, { color: colors.primary }]}>
                Meeting / Title:
              </Text>
              <Text style={[styles.colDesc, { color: colors.text }]}>
                "Meeting Name", "Topic", "Session"
              </Text>
            </View>
            <View style={styles.guideItem}>
              <Text style={[styles.colName, { color: colors.primary }]}>
                Date:
              </Text>
              <Text style={[styles.colDesc, { color: colors.text }]}>
                "Date", "Meeting Date", "YYYY-MM-DD", "MM/DD/YYYY"
              </Text>
            </View>
            <View style={styles.guideItem}>
              <Text style={[styles.colName, { color: colors.primary }]}>
                Start & End Time:
              </Text>
              <Text style={[styles.colDesc, { color: colors.text }]}>
                "10:00 AM", "14:30", "Duration (mins)"
              </Text>
            </View>
            <View style={styles.guideItem}>
              <Text style={[styles.colName, { color: colors.primary }]}>
                Meeting Link:
              </Text>
              <Text style={[styles.colDesc, { color: colors.text }]}>
                Google Meet, Zoom, MS Teams, or web link
              </Text>
            </View>
            <View style={styles.guideItem}>
              <Text style={[styles.colName, { color: colors.primary }]}>
                Alarm / Reminder:
              </Text>
              <Text style={[styles.colDesc, { color: colors.text }]}>
                "15" or "15m" for custom minutes before
              </Text>
            </View>
          </View>
        </Card>
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
  closeBtn: {
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
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  methodIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  methodDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  guideCard: {
    padding: 16,
    marginTop: 10,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  guideText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  guideList: {
    gap: 8,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  colName: {
    fontSize: 12,
    fontWeight: '700',
    width: 100,
  },
  colDesc: {
    fontSize: 12,
    flex: 1,
  },
});
