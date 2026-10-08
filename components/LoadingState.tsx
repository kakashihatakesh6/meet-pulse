import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export interface LoadingStateProps {
  count?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ count = 3 }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.skeletonCard,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          {/* Top Bar Skeleton */}
          <View style={styles.skeletonRow}>
            <View
              style={[
                styles.skeletonLine,
                {
                  width: '40%',
                  height: 14,
                  backgroundColor: colors.surfaceSubtle,
                },
              ]}
            />
            <View
              style={[
                styles.skeletonLine,
                {
                  width: 60,
                  height: 18,
                  borderRadius: 999,
                  backgroundColor: colors.surfaceSubtle,
                },
              ]}
            />
          </View>

          {/* Title Skeleton */}
          <View
            style={[
              styles.skeletonLine,
              {
                width: '80%',
                height: 20,
                marginVertical: 12,
                backgroundColor: colors.surfaceSubtle,
              },
            ]}
          />

          {/* Badges Skeleton */}
          <View style={styles.skeletonRow}>
            <View
              style={[
                styles.skeletonLine,
                {
                  width: 80,
                  height: 20,
                  borderRadius: 6,
                  backgroundColor: colors.surfaceSubtle,
                },
              ]}
            />
            <View
              style={[
                styles.skeletonLine,
                {
                  width: 100,
                  height: 20,
                  borderRadius: 6,
                  backgroundColor: colors.surfaceSubtle,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  skeletonCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  skeletonLine: {
    borderRadius: 6,
  },
});
