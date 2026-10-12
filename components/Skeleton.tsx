import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  DimensionValue,
  Platform,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
  variant?: 'box' | 'circle' | 'text' | 'badge';
}

/**
 * Atomic animated pulsing skeleton element with fluid breath animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius,
  style,
  variant = 'box',
}) => {
  const { isDark } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  let defaultHeight: DimensionValue = 16;
  let defaultRadius = 8;

  if (variant === 'circle') {
    defaultRadius = typeof width === 'number' ? width / 2 : 20;
    defaultHeight = width || 40;
  } else if (variant === 'text') {
    defaultHeight = 14;
    defaultRadius = 4;
  } else if (variant === 'badge') {
    defaultHeight = 22;
    defaultRadius = 999;
  }

  const baseBg = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.06)';

  return (
    <Animated.View
      style={[
        {
          width: width || '100%',
          height: height || defaultHeight,
          borderRadius: borderRadius !== undefined ? borderRadius : defaultRadius,
          backgroundColor: baseBg,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton matching a MeetingCard item
 */
export const MeetingCardSkeleton: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.meetingCardContainer,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
        },
        style,
      ]}
    >
      {/* Top Row: Date & Time range + Status badge */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTimeGroup}>
          <Skeleton width={14} height={14} borderRadius={4} />
          <Skeleton width={120} height={14} borderRadius={4} />
          <Skeleton width={45} height={16} borderRadius={4} />
        </View>
        <Skeleton width={75} height={20} variant="badge" />
      </View>

      {/* Meeting Title */}
      <Skeleton
        width="85%"
        height={20}
        borderRadius={6}
        style={{ marginVertical: 10 }}
      />
      <Skeleton
        width="55%"
        height={16}
        borderRadius={4}
        style={{ marginBottom: 12 }}
      />

      {/* Relative Urgency Bar */}
      <View style={styles.urgencyRow}>
        <Skeleton width={14} height={14} variant="circle" />
        <Skeleton width={140} height={13} borderRadius={4} />
      </View>

      {/* Bottom Row: Platform Badge + Alarm summary */}
      <View style={styles.cardBottomRow}>
        <Skeleton width={90} height={26} borderRadius={8} />
        <Skeleton width={80} height={26} borderRadius={8} />
      </View>
    </View>
  );
};

/**
 * Full Dashboard loading skeleton
 */
export const DashboardSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.screenContainer}>
      {/* Quick Actions Row */}
      <View style={styles.quickActionsRow}>
        <View
          style={[
            styles.actionBtnSkeleton,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          <Skeleton width={36} height={36} variant="circle" style={{ marginRight: 10 }} />
          <Skeleton width={90} height={16} borderRadius={4} />
        </View>
        <View
          style={[
            styles.actionBtnSkeleton,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          <Skeleton width={36} height={36} variant="circle" style={{ marginRight: 10 }} />
          <Skeleton width={80} height={16} borderRadius={4} />
        </View>
      </View>

      {/* Next Meeting Spotlight Spotlight */}
      <View style={styles.sectionHeader}>
        <Skeleton width={80} height={12} borderRadius={4} />
      </View>
      <View
        style={[
          styles.spotlightSkeleton,
          { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <Skeleton width={130} height={16} borderRadius={4} />
          <Skeleton width={90} height={14} borderRadius={4} />
        </View>
        <Skeleton width="90%" height={24} borderRadius={6} style={{ marginVertical: 14 }} />
        <View style={styles.cardBottomRow}>
          <Skeleton width={100} height={30} borderRadius={8} />
          <Skeleton width={100} height={30} borderRadius={8} />
        </View>
      </View>

      {/* 3 Stats Metrics Box */}
      <View style={styles.statsRow}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.statCardSkeleton,
              { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
            ]}
          >
            <Skeleton width={28} height={28} borderRadius={6} style={{ marginBottom: 6 }} />
            <Skeleton width={48} height={12} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Today's Schedule Section */}
      <View style={styles.sectionHeader}>
        <Skeleton width={140} height={14} borderRadius={4} />
        <Skeleton width={80} height={14} borderRadius={4} />
      </View>

      <MeetingCardSkeleton />
      <MeetingCardSkeleton />
    </View>
  );
};

/**
 * Calendar Screen loading skeleton
 */
export const CalendarSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.screenContainer}>
      {/* Search bar skeleton */}
      <View
        style={[
          styles.searchSkeleton,
          { backgroundColor: colors.surfaceSubtle, borderColor: colors.surfaceBorder },
        ]}
      >
        <Skeleton width={18} height={18} variant="circle" style={{ marginRight: 10 }} />
        <Skeleton width="70%" height={16} borderRadius={4} />
      </View>

      {/* Tabs Row Skeleton */}
      <View style={styles.tabsRow}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton
            key={i}
            width="23%"
            height={34}
            borderRadius={10}
            style={{ marginHorizontal: 2 }}
          />
        ))}
      </View>

      {/* Overview bar skeleton */}
      <View
        style={[
          styles.overviewBarSkeleton,
          { backgroundColor: colors.surfaceSubtle, borderColor: colors.surfaceBorder },
        ]}
      >
        <Skeleton width={16} height={16} variant="circle" style={{ marginRight: 8 }} />
        <Skeleton width={160} height={14} borderRadius={4} />
      </View>

      {/* List cards */}
      <MeetingCardSkeleton />
      <MeetingCardSkeleton />
      <MeetingCardSkeleton />
    </View>
  );
};

/**
 * Alarms Screen loading skeleton
 */
export const AlarmsSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.screenContainer}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.alarmCardSkeleton,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.alarmLeftContent}>
            <Skeleton width={42} height={42} variant="circle" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Skeleton width="70%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
              <Skeleton width="45%" height={13} borderRadius={4} style={{ marginBottom: 4 }} />
              <Skeleton width="55%" height={12} borderRadius={4} />
            </View>
          </View>
          <Skeleton width={44} height={26} borderRadius={14} />
        </View>
      ))}
    </View>
  );
};

/**
 * Meeting Details Screen loading skeleton
 */
export const MeetingDetailsSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.screenContainer}>
      {/* Title section with badges */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <Skeleton width={90} height={22} variant="badge" />
          <Skeleton width={110} height={22} variant="badge" />
        </View>
        <Skeleton width="90%" height={28} borderRadius={8} style={{ marginBottom: 8 }} />
        <Skeleton width="60%" height={22} borderRadius={6} />
      </View>

      {/* Time & Join Card */}
      <View
        style={[
          styles.detailsCard,
          { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Skeleton width={40} height={40} variant="circle" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Skeleton width="65%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width="50%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
            <Skeleton width="35%" height={12} borderRadius={4} />
          </View>
        </View>
        <Skeleton width="100%" height={46} borderRadius={12} />
      </View>

      {/* Alarms Section Card */}
      <View style={{ marginBottom: 16 }}>
        <Skeleton width={140} height={13} borderRadius={4} style={{ marginBottom: 8 }} />
        <View
          style={[
            styles.detailsCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
          ]}
        >
          {[1, 2].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Skeleton width={20} height={20} variant="circle" style={{ marginRight: 10 }} />
                <View>
                  <Skeleton width={110} height={14} borderRadius={4} style={{ marginBottom: 4 }} />
                  <Skeleton width={80} height={12} borderRadius={4} />
                </View>
              </View>
              <Skeleton width={36} height={22} borderRadius={11} />
            </View>
          ))}
        </View>
      </View>

      {/* Description Card */}
      <View style={{ marginBottom: 16 }}>
        <Skeleton width={120} height={13} borderRadius={4} style={{ marginBottom: 8 }} />
        <View
          style={[
            styles.detailsCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
          ]}
        >
          <Skeleton width="100%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
          <Skeleton width="92%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
          <Skeleton width="75%" height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  );
};

/**
 * Calendars list skeleton
 */
export const CalendarsListSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.screenContainer}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.calendarItemSkeleton,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
          ]}
        >
          <Skeleton width={16} height={16} variant="circle" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Skeleton width="65%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width="45%" height={13} borderRadius={4} />
          </View>
          <Skeleton width={44} height={26} borderRadius={14} />
        </View>
      ))}
    </View>
  );
};

/**
 * Google Sheets Picker Screen loading skeleton
 */
export const SheetsPickerSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.screenContainer}>
      <Skeleton width={140} height={13} borderRadius={4} style={{ marginBottom: 14 }} />
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.sheetCardSkeleton,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
          ]}
        >
          <Skeleton width={42} height={42} borderRadius={10} style={{ marginRight: 12 }} />
          <View style={{ flex: 1, marginRight: 10 }}>
            <Skeleton width="75%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width="40%" height={12} borderRadius={4} />
          </View>
          <Skeleton width={18} height={18} variant="circle" />
        </View>
      ))}
    </View>
  );
};

/**
 * Import Preview Screen loading skeleton
 */
export const ImportPreviewSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.screenContainer}>
      {/* Summary Card */}
      <View
        style={[
          styles.summaryCardSkeleton,
          { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
        ]}
      >
        <Skeleton width="50%" height={20} borderRadius={6} style={{ marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton width={80} height={26} borderRadius={8} />
          <Skeleton width={90} height={26} borderRadius={8} />
          <Skeleton width={85} height={26} borderRadius={8} />
        </View>
      </View>

      {/* Preset Alarm row */}
      <Skeleton width={150} height={12} borderRadius={4} style={{ marginVertical: 8 }} />
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={64} height={28} borderRadius={8} />
        ))}
      </View>

      {/* List items */}
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.previewItemSkeleton,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Skeleton width={20} height={20} borderRadius={4} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Skeleton width="70%" height={15} borderRadius={4} style={{ marginBottom: 4 }} />
              <Skeleton width="45%" height={12} borderRadius={4} />
            </View>
            <Skeleton width={55} height={18} borderRadius={4} />
          </View>
          <Skeleton width={90} height={20} borderRadius={6} />
        </View>
      ))}
    </View>
  );
};

/**
 * App Initial Splash / Auth checking skeleton
 */
export const AppSplashSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={[styles.splashContainer, { backgroundColor: colors.background }]}>
      <Skeleton
        width={80}
        height={80}
        variant="circle"
        style={{ marginBottom: 20 }}
      />
      <Skeleton
        width={160}
        height={26}
        borderRadius={8}
        style={{ marginBottom: 10 }}
      />
      <Skeleton
        width={220}
        height={14}
        borderRadius={6}
        style={{ marginBottom: 24 }}
      />
      <Skeleton
        width={100}
        height={8}
        borderRadius={4}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  meetingCardContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTimeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  urgencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtnSkeleton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  spotlightSkeleton: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statCardSkeleton: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  searchSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  overviewBarSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  alarmCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  alarmLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  calendarItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  sheetCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  summaryCardSkeleton: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  previewItemSkeleton: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
});
