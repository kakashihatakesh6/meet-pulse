import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth.store';
import { useSettingsStore } from '../../store/settings.store';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useNotifications } from '../../hooks/useNotifications';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { useTheme } from '../../hooks/useTheme';
import { MeetingsRepository } from '../../services/database/repositories/meetings.repository';
import { CalendarsRepository } from '../../services/database/repositories/calendars.repository';
import { AlarmsRepository } from '../../services/database/repositories/alarms.repository';
import { SyncRepository } from '../../services/database/repositories/sync.repository';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ThemeMode } from '../../types/settings';
import { formatAlarmOffsetLabel } from '../../constants/alarms';

export default function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { signIn, signOut } = useGoogleAuth();
  const { settings, updateSettings, setTheme } = useSettingsStore();
  const { sync, isSyncing, lastSyncedLabel } = useCalendarSync();
  const { isGranted, requestPermissions } = useNotifications();

  const [isClearing, setIsClearing] = useState(false);

  const handleSignOut = async () => {
    const executeSignOut = async () => {
      try {
        await signOut();
        router.replace('/(auth)/login');
      } catch (err) {
        router.replace('/(auth)/login');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(
              'Are you sure you want to sign out? Your credentials will be wiped from this device.'
            )
          : true;
      if (confirmed) {
        await executeSignOut();
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out? Your cached credentials will be securely wiped.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: executeSignOut,
          },
        ]
      );
    }
  };

  const handleClearImportedMeetings = async () => {
    const executeClear = async () => {
      const count = await MeetingsRepository.clearAllImportedMeetings();
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.alert(`Removed ${count} imported meeting(s).`);
        }
      } else {
        Alert.alert('Success', `Removed ${count} imported meeting(s).`);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(
              'This will remove all spreadsheets-imported meetings and their alarms.'
            )
          : true;
      if (confirmed) {
        await executeClear();
      }
    } else {
      Alert.alert(
        'Clear Imported Meetings',
        'This will remove all spreadsheets-imported meetings and their alarms.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear Imported',
            style: 'destructive',
            onPress: executeClear,
          },
        ]
      );
    }
  };

  const handleClearAllData = async () => {
    const executeClearAll = async () => {
      setIsClearing(true);
      try {
        await AlarmsRepository.clearAll();
        await MeetingsRepository.clearAllMeetings();
        await CalendarsRepository.clearAll();
        await SyncRepository.clearAll();
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') {
            window.alert('All local cached data has been reset.');
          }
        } else {
          Alert.alert('Database Cleared', 'All local cached data has been reset.');
        }
      } finally {
        setIsClearing(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(
              'This will erase all cached Google Calendar meetings, imported files, scheduled alarms, and sync history from this device.'
            )
          : true;
      if (confirmed) {
        await executeClearAll();
      }
    } else {
      Alert.alert(
        'Clear All Local Data',
        'This will erase all cached Google Calendar meetings, imported files, scheduled alarms, and sync history from this device.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Erase Everything',
            style: 'destructive',
            onPress: executeClearAll,
          },
        ]
      );
    }
  };

  const toggleDefaultAlarmOffset = (minutes: number) => {
    const current = settings.defaultAlarmOffsets || [15];
    const updated = current.includes(minutes)
      ? current.filter((m) => m !== minutes)
      : [...current, minutes].sort((a, b) => a - b);
    updateSettings({ defaultAlarmOffsets: updated.length > 0 ? updated : [15] });
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          Settings
        </Text>

        {/* 1. Account Section */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
          GOOGLE ACCOUNT
        </Text>
        <Card style={styles.card}>
          {isAuthenticated && user ? (
            <View style={styles.accountRow}>
              {user.picture ? (
                <Image source={{ uri: user.picture }} style={styles.avatar} />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Ionicons name="person" size={24} color={colors.primary} />
                </View>
              )}
              <View style={styles.accountInfo}>
                <Text style={[styles.accountName, { color: colors.text }]}>
                  {user.name}
                </Text>
                <Text
                  style={[styles.accountEmail, { color: colors.textMuted }]}
                >
                  {user.email}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.notConnectedRow}>
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color={colors.warning}
              />
              <Text
                style={[styles.notConnectedText, { color: colors.textMuted }]}
              >
                Not connected with Google
              </Text>
            </View>
          )}

          <View
            style={[styles.divider, { backgroundColor: colors.surfaceBorder }]}
          />

          <TouchableOpacity
            onPress={() => router.push('/calendars')}
            style={styles.menuRow}
          >
            <View style={styles.menuLeft}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.menuText, { color: colors.text }]}>
                Connected Calendars
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          <View
            style={[styles.divider, { backgroundColor: colors.surfaceBorder }]}
          />

          <View style={styles.authButtonsRow}>
            {isAuthenticated ? (
              <>
                <Button
                  title="Reconnect Google"
                  onPress={signIn}
                  variant="outline"
                  size="sm"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Sign Out"
                  onPress={handleSignOut}
                  variant="danger"
                  size="sm"
                  style={{ flex: 1 }}
                />
              </>
            ) : (
              <Button
                title="Connect with Google"
                onPress={signIn}
                variant="primary"
                size="md"
                style={{ width: '100%' }}
              />
            )}
          </View>
        </Card>

        {/* 2. Notifications Section */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
          NOTIFICATIONS & ALARMS
        </Text>
        <Card style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>
                Notification Permissions
              </Text>
              <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
                {isGranted
                  ? 'Active and enabled'
                  : 'Disabled in device settings'}
              </Text>
            </View>
            {!isGranted ? (
              <Button
                title="Enable"
                onPress={requestPermissions}
                size="sm"
                variant="primary"
              />
            ) : (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.success}
              />
            )}
          </View>

          <View
            style={[styles.divider, { backgroundColor: colors.surfaceBorder }]}
          />

          {/* Default Reminders Selector */}
          <Text
            style={[
              styles.itemTitle,
              { color: colors.text, marginBottom: 8, marginTop: 4 },
            ]}
          >
            Default Alarm Offsets for New Meetings
          </Text>
          <View style={styles.offsetChipsRow}>
            {[0, 5, 10, 15, 30, 60].map((mins) => {
              const isSelected = (settings.defaultAlarmOffsets || [15]).includes(
                mins
              );
              return (
                <TouchableOpacity
                  key={mins}
                  onPress={() => toggleDefaultAlarmOffset(mins)}
                  style={[
                    styles.offsetChip,
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
                      styles.offsetChipText,
                      {
                        color: isSelected ? colors.primary : colors.textMuted,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {formatAlarmOffsetLabel(mins)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* 3. Calendar & Sync Section */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
          CALENDAR SYNCHRONIZATION
        </Text>
        <Card style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>
                Sync on App Open
              </Text>
              <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
                Automatically check Google Calendar when app launches
              </Text>
            </View>
            <Switch
              value={settings.autoSyncOnAppOpen}
              onValueChange={(val) => updateSettings({ autoSyncOnAppOpen: val })}
              trackColor={{ false: colors.surfaceSubtle, true: colors.primaryLight }}
              thumbColor={settings.autoSyncOnAppOpen ? colors.primary : colors.textSubtle}
            />
          </View>

          <View
            style={[styles.divider, { backgroundColor: colors.surfaceBorder }]}
          />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>
                {lastSyncedLabel}
              </Text>
              <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
                Direct Google Calendar sync
              </Text>
            </View>
            <Button
              title={isSyncing ? 'Syncing...' : 'Sync Now'}
              onPress={() => sync()}
              isLoading={isSyncing}
              size="sm"
              variant="secondary"
            />
          </View>
        </Card>

        {/* 4. Appearance Section */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
          APPEARANCE
        </Text>
        <Card style={styles.card}>
          <View style={styles.themeSelectorRow}>
            {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => {
              const isSelected = settings.theme === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setTheme(mode)}
                  style={[
                    styles.themeBtn,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.surfaceSubtle,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      mode === 'system'
                        ? 'phone-portrait-outline'
                        : mode === 'light'
                        ? 'sunny-outline'
                        : 'moon-outline'
                    }
                    size={16}
                    color={isSelected ? '#FFFFFF' : colors.textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.themeBtnText,
                      {
                        color: isSelected ? '#FFFFFF' : colors.textMuted,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {mode.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* 5. Data Management */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
          DATA & STORAGE
        </Text>
        <Card style={styles.card}>
          <TouchableOpacity
            onPress={handleClearImportedMeetings}
            style={styles.menuRow}
          >
            <View style={styles.menuLeft}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={colors.warning}
              />
              <Text style={[styles.menuText, { color: colors.text }]}>
                Clear Imported Meetings
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          <View
            style={[styles.divider, { backgroundColor: colors.surfaceBorder }]}
          />

          <TouchableOpacity
            onPress={handleClearAllData}
            style={styles.menuRow}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.menuText, { color: colors.danger }]}>
                Clear All Local Cache
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </Card>

        {/* 6. About Section */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
          ABOUT
        </Text>
        <Card style={styles.card} variant="subtle">
          <Text style={[styles.aboutTitle, { color: colors.text }]}>
            Meeting Alarm v1.0.0
          </Text>
          <Text style={[styles.aboutText, { color: colors.textMuted }]}>
            Built with 100% on-device architecture using React Native, Expo, SQLite,
            and SecureStore. No custom backend server is used; all Google Calendar
            and Sheets API requests are handled directly from your mobile device.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    padding: 16,
    borderRadius: 16,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: 13,
  },
  notConnectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notConnectedText: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
  },
  authButtonsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  offsetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  offsetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  offsetChipText: {
    fontSize: 12,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  themeBtnText: {
    fontSize: 12,
  },
  aboutTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  aboutText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
