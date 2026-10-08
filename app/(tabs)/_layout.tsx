import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

export default function TabLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={size || 22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={size || 22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="alarms"
        options={{
          title: 'Alarms',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              size={size || 22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size || 22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
