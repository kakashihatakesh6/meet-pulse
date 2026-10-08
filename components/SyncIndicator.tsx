import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCalendarSync } from '../hooks/useCalendarSync';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/auth.store';

export const SyncIndicator: React.FC = () => {
  const { colors } = useTheme();
  const { isOffline } = useAuthStore();
  const { sync, isSyncing, lastSyncedLabel, syncError } = useCalendarSync();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => sync()}
      disabled={isSyncing}
      style={[
        styles.container,
        {
          backgroundColor: isOffline
            ? colors.warningLight
            : colors.surfaceSubtle,
          borderColor: isOffline
            ? colors.warningBorder
            : colors.surfaceBorder,
        },
      ]}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
      ) : isOffline ? (
        <Ionicons
          name="cloud-offline-outline"
          size={14}
          color={colors.warning}
          style={{ marginRight: 6 }}
        />
      ) : (
        <Ionicons
          name="sync"
          size={14}
          color={colors.primary}
          style={{ marginRight: 6 }}
        />
      )}

      <Text
        style={[
          styles.text,
          {
            color: isOffline ? colors.warning : colors.textMuted,
          },
        ]}
      >
        {isSyncing
          ? 'Syncing calendar...'
          : isOffline
          ? 'Offline mode'
          : lastSyncedLabel}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
