import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MeetingStatus } from '../types/meeting';
import { useTheme } from '../hooks/useTheme';

export interface MeetingStatusBadgeProps {
  status: MeetingStatus;
  size?: 'sm' | 'md';
}

export const MeetingStatusBadge: React.FC<MeetingStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const { colors } = useTheme();

  const getStatusConfig = () => {
    switch (status) {
      case 'in_progress':
        return {
          label: 'IN PROGRESS',
          bg: colors.successLight,
          border: colors.successBorder,
          text: colors.success,
          dotColor: colors.success,
        };
      case 'upcoming':
        return {
          label: 'UPCOMING',
          bg: colors.infoLight,
          border: colors.infoBorder,
          text: colors.info,
          dotColor: colors.info,
        };
      case 'completed':
        return {
          label: 'COMPLETED',
          bg: colors.surfaceSubtle,
          border: colors.surfaceBorder,
          text: colors.textMuted,
          dotColor: colors.textMuted,
        };
      case 'cancelled':
        return {
          label: 'CANCELLED',
          bg: colors.dangerLight,
          border: colors.dangerBorder,
          text: colors.danger,
          dotColor: colors.danger,
        };
    }
  };

  const config = getStatusConfig();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 6 : 8,
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: config.dotColor,
            width: isSm ? 5 : 6,
            height: isSm ? 5 : 6,
          },
        ]}
      />
      <Text
        style={[
          styles.text,
          {
            color: config.text,
            fontSize: isSm ? 10 : 11,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    borderRadius: 999,
    marginRight: 5,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
