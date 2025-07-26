// components/TimelineSelector.js
import React from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_PADDING = 24;
const TIMELINE_WIDTH = screenWidth - (TIMELINE_PADDING * 4); // Account for container padding

export default function TimelineSelector({
  currentTime,
  totalDuration,
  onTimeChange,
  scrubberPosition
}) {
  // Pan responder for timeline interaction
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    
    onPanResponderGrant: (evt) => {
      // Handle tap anywhere on timeline
      const tapX = evt.nativeEvent.locationX;
      const newTime = Math.max(0, Math.min((tapX / TIMELINE_WIDTH) * totalDuration, totalDuration));
      onTimeChange(newTime);
    },
    
    onPanResponderMove: (evt, gestureState) => {
      // Handle drag from initial position
      const startX = (currentTime / totalDuration) * TIMELINE_WIDTH;
      const newX = Math.max(0, Math.min(startX + gestureState.dx, TIMELINE_WIDTH));
      const newTime = (newX / TIMELINE_WIDTH) * totalDuration;
      onTimeChange(newTime);
    },
    
    onPanResponderRelease: () => {
      // Finalize the position - nothing special needed
    },
  });

  // Animated styles for scrubber
  const scrubberStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrubberPosition.value }],
  }));

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.timeLabel}>
          Start Position: {formatTime(currentTime)} / {formatTime(totalDuration)}
        </Text>
      </View>
      
      <View style={styles.timelineContainer} {...panResponder.panHandlers}>
        <View style={styles.timelineTrack}>
          <Animated.View style={[styles.scrubber, scrubberStyle]} />
        </View>
      </View>
      
      <Text style={styles.instruction}>
        Drag to select practice start position
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  header: {
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  timelineContainer: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 8,
  },
  timelineTrack: {
    height: 6,
    backgroundColor: '#ddd',
    borderRadius: 3,
    position: 'relative',
  },
  scrubber: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 20,
    backgroundColor: '#000',
    borderRadius: 10,
    marginLeft: -10,
  },
  instruction: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});