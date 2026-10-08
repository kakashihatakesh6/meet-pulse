import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { useAuthStore } from '../../store/auth.store';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import * as WebBrowser from 'expo-web-browser';

// Completes auth session for web browser redirect if popup was used
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { signIn, isLoading, error } = useGoogleAuth();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const handleContinueOffline = () => {
    router.replace('/(tabs)/dashboard');
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Branding Hero */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.logoCircle,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons name="alarm" size={44} color={colors.primary} />
          </View>
          <Text style={[styles.appTitle, { color: colors.text }]}>
            Meeting Alarm
          </Text>
          <Text style={[styles.appTagline, { color: colors.textMuted }]}>
            Never miss a meeting again. High-precision local alarms for your
            calendar events & spreadsheet schedules.
          </Text>
        </View>

        {/* Value Proposition Cards */}
        <View style={styles.featuresSection}>
          <Card style={styles.featureCard} variant="subtle">
            <View style={styles.featureRow}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: colors.infoLight },
                ]}
              >
                <Ionicons name="calendar" size={20} color={colors.info} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  Direct Google Calendar Sync
                </Text>
                <Text
                  style={[styles.featureDesc, { color: colors.textMuted }]}
                >
                  Syncs directly from Google Calendar on-device with zero intermediate servers.
                </Text>
              </View>
            </View>
          </Card>

          <Card style={styles.featureCard} variant="subtle">
            <View style={styles.featureRow}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Ionicons
                  name="notifications"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  Reliable Local Alarms
                </Text>
                <Text
                  style={[styles.featureDesc, { color: colors.textMuted }]}
                >
                  Configurable 0/5/10/15/30/60m alarms that ring even when offline.
                </Text>
              </View>
            </View>
          </Card>

          <Card style={styles.featureCard} variant="subtle">
            <View style={styles.featureRow}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: colors.accentLight },
                ]}
              >
                <Ionicons
                  name="document-text"
                  size={20}
                  color={colors.accent}
                />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  Excel, CSV & Sheets Import
                </Text>
                <Text
                  style={[styles.featureDesc, { color: colors.textMuted }]}
                >
                  Import batch interview or meeting schedules with automatic column mapping.
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Error Banner if any */}
        {error ? (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: colors.dangerLight,
                borderColor: colors.dangerBorder,
              },
            ]}
          >
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Button
            title="Continue with Google"
            onPress={signIn}
            isLoading={isLoading}
            variant="primary"
            size="lg"
            icon="logo-google"
            style={styles.signInButton}
          />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleContinueOffline}
            style={styles.offlineButton}
          >
            <Text
              style={[styles.offlineButtonText, { color: colors.textMuted }]}
            >
              Continue Offline (Saved Data Only)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Note */}
        <Text style={[styles.privacyNote, { color: colors.textSubtle }]}>
          🔒 Private & Serverless: All data and OAuth tokens are stored locally on
          your device using SQLite & SecureStore.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  featuresSection: {
    width: '100%',
    marginBottom: 20,
    gap: 10,
  },
  featureCard: {
    padding: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  actionsSection: {
    width: '100%',
    marginTop: 8,
    marginBottom: 20,
  },
  signInButton: {
    width: '100%',
    marginBottom: 12,
  },
  offlineButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  offlineButtonText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  privacyNote: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 300,
  },
});
