import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const { colors, isDark } = useTheme();

  const getBackgroundColor = () => {
    if (disabled) return isDark ? '#1E293B' : '#E2E8F0';
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.surfaceSubtle;
      case 'outline':
        return 'transparent';
      case 'danger':
        return colors.danger;
      case 'ghost':
        return 'transparent';
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') {
      return disabled ? (isDark ? '#334155' : '#CBD5E1') : colors.primary;
    }
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return colors.textSubtle;
    switch (variant) {
      case 'primary':
      case 'danger':
        return '#FFFFFF';
      case 'secondary':
        return colors.text;
      case 'outline':
        return colors.primary;
      case 'ghost':
        return colors.primary;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 8, paddingHorizontal: 14 };
      case 'lg':
        return { paddingVertical: 16, paddingHorizontal: 24 };
      case 'md':
      default:
        return { paddingVertical: 12, paddingHorizontal: 18 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return 13;
      case 'lg':
        return 16;
      case 'md':
      default:
        return 14;
    }
  };

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;
  const textColor = getTextColor();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || isLoading}
      style={[
        styles.button,
        getPadding(),
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1.5 : 0,
        },
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={textColor}
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={[
              styles.text,
              { color: textColor, fontSize: getFontSize() },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={textColor}
              style={{ marginLeft: 8 }}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
