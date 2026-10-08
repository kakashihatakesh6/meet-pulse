import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { CalendarEntity } from '../types/calendar';
import { useTheme } from '../hooks/useTheme';

export interface CalendarCardProps {
  calendar: CalendarEntity;
  onToggle: (calendarId: string, isEnabled: boolean) => void;
}

export const CalendarCard: React.FC<CalendarCardProps> = ({
  calendar,
  onToggle,
}) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.colorDot,
            { backgroundColor: calendar.backgroundColor || colors.primary },
          ]}
        />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.summary, { color: colors.text }]}
              numberOfLines={1}
            >
              {calendar.summary}
            </Text>
            {calendar.primary && (
              <View
                style={[
                  styles.primaryBadge,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Text
                  style={[styles.primaryText, { color: colors.primary }]}
                >
                  PRIMARY
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.calendarId, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {calendar.googleCalendarId}
          </Text>
        </View>
      </View>

      <Switch
        value={calendar.isEnabled}
        onValueChange={(val) => onToggle(calendar.id, val)}
        trackColor={{ false: colors.surfaceSubtle, true: colors.primaryLight }}
        thumbColor={calendar.isEnabled ? colors.primary : colors.textSubtle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  summary: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  primaryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  primaryText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  calendarId: {
    fontSize: 12,
  },
});
