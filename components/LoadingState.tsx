import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { MeetingCardSkeleton } from './Skeleton';

export interface LoadingStateProps {
  count?: number;
  style?: ViewStyle;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ count = 3, style }) => {
  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <MeetingCardSkeleton key={index} />
      ))}
    </View>
  );
};

export * from './Skeleton';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
