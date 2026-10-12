import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/auth.store';
import { AppSplashSkeleton } from '../components/Skeleton';

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [timedOut, setTimedOut] = useState(false);

  // Safety fallback: if loading takes longer than 1.5 seconds, force unblock
  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading && !timedOut) {
    return <AppSplashSkeleton />;
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
