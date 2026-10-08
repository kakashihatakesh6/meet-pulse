import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/auth.store';
import { useTheme } from '../hooks/useTheme';
import { SyncIndicator } from './SyncIndicator';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  showUserGreeting?: boolean;
  showSyncIndicator?: boolean;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showUserGreeting = false,
  showSyncIndicator = false,
  rightAction,
}) => {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const router = useRouter();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = user?.givenName || user?.name || 'there';

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showUserGreeting ? (
          <>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>
              {getGreeting()}, {displayName} 👋
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              {title || "Today's Meetings"}
            </Text>
          </>
        ) : (
          <>
            {title && (
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            )}
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {subtitle}
              </Text>
            )}
          </>
        )}

        {showSyncIndicator && (
          <View style={{ marginTop: 6 }}>
            <SyncIndicator />
          </View>
        )}
      </View>

      <View style={styles.right}>
        {rightAction}
        {user?.picture ? (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.8}
            style={styles.avatarButton}
          >
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  left: {
    flex: 1,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  avatarButton: {
    padding: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
});
