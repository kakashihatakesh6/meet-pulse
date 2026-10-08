import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/auth.store';
import { useTheme } from '../hooks/useTheme';

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { colors } = useTheme();
  const [timedOut, setTimedOut] = useState(false);

  // Safety fallback: if loading takes longer than 1.5 seconds, force unblock
  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading && !timedOut) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
