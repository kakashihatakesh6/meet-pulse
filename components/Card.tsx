import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'subtle';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'elevated',
}) => {
  const { colors, isDark } = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case 'subtle':
        return colors.surfaceSubtle;
      case 'outlined':
      case 'elevated':
      default:
        return colors.cardBg;
    }
  };

  const cardStyle: ViewStyle = {
    backgroundColor: getBackgroundColor(),
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: isDark ? '#000000' : '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.06,
    shadowRadius: 8,
    elevation: variant === 'elevated' ? 3 : 0,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[cardStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};
