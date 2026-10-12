import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../store/auth.store';
import { useSettingsStore } from '../store/settings.store';
import { getDatabase } from '../services/database/database';
import { BackgroundSyncManager } from '../services/sync/background.task';
import { useTheme } from '../hooks/useTheme';
import { logger } from '../utils/logger';

// Keep splash screen visible while initializing app
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayoutContent() {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="meeting/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="import"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="calendars/index"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [isAppReady, setIsAppReady] = useState(false);
  const initializeSession = useAuthStore((s) => s.initializeSession);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    let isMounted = true;

    async function prepareApp() {
      try {
        logger.info('Initializing Meeting Alarm...');

        // 1. Initialize SQLite Database and schema migrations
        try {
          await getDatabase();
        } catch (dbErr) {
          logger.warn('Database initialization warning', dbErr);
        }

        // 2. Load persistent app settings
        try {
          await loadSettings();
        } catch (settingsErr) {
          logger.warn('Settings load warning', settingsErr);
        }

        // 3. Restore authentication session from SecureStore
        try {
          await initializeSession();
        } catch (authErr) {
          logger.warn('Auth session initialization warning', authErr);
        }

        // 4. Register background sync task on native platforms
        if (Platform.OS !== 'web') {
          try {
            await BackgroundSyncManager.registerBackgroundSync();
          } catch (syncErr) {
            logger.warn('Background sync registration warning', syncErr);
          }
        }

        logger.info('App initialization completed');
      } catch (err) {
        logger.error('Failed to initialize app', err);
      } finally {
        if (isMounted) {
          setIsAppReady(true);
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    prepareApp();

    return () => {
      isMounted = false;
    };
  }, [initializeSession, loadSettings]);

  if (!isAppReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <RootLayoutContent />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
