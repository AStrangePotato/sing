// components/PitchVisualizer.jsx
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Svg, Circle, Line } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');
const GRAPH_WIDTH = screenWidth - 48; // Adjusted for padding
const GRAPH_HEIGHT = 250;
const PIXELS_PER_SECOND = 60;
const SCROLL_OFFSET = GRAPH_WIDTH / 3; // Keep playback head 1/3 from left

// Frequency to Y position converter
const freqToY = (freq) => {
  if (!freq || freq <= 0) return GRAPH_HEIGHT;
  const minFreq = 100;
  const maxFreq = 350;
  const logMinFreq = Math.log2(minFreq);
  const logMaxFreq = Math.log2(maxFreq);
  const padding = 25;
  const logFreq = Math.log2(freq);
  const normalized = (logFreq - logMinFreq) / (logMaxFreq - logMinFreq);
  return GRAPH_HEIGHT - (normalized * (GRAPH_HEIGHT - padding * 2) + padding);
};

export default function PitchVisualizer({
  referencePitches,
  userPitches,
  currentPlaybackTime,
  totalDuration,
  selectedStartTime,
  isActionActive, // To control auto-scrolling
}) {
  const scrollViewRef = useRef(null);

  // Auto-scroll to follow playback/recording
  useEffect(() => {
    if (scrollViewRef.current && isActionActive) {
      const scrollX = Math.max(0, currentPlaybackTime * PIXELS_PER_SECOND - SCROLL_OFFSET);
      scrollViewRef.current.scrollTo({ x: scrollX, animated: false });
    }
  }, [currentPlaybackTime, isActionActive]);

  const graphWidth = Math.max(GRAPH_WIDTH, totalDuration * PIXELS_PER_SECOND + 100);

  // Note frequencies for grid lines
  const gridFrequencies = [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 277.18, 311.13, 329.63];
  
  // Y-axis labels
  const yAxisLabels = [
    { note: 'E4', freq: 329.63 }, { note: 'C4', freq: 261.63 },
    { note: 'A3', freq: 220.00 }, { note: 'G3', freq: 196.00 },
    { note: 'D3', freq: 146.83 }, { note: 'C3', freq: 130.81 },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pitch Visualization</Text>
      
      <View style={styles.graphContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          {yAxisLabels.map((item, index) => (
            <Text key={index} style={[styles.yAxisLabel, { top: freqToY(item.freq) - 8 }]}>
              {item.note}
            </Text>
          ))}
        </View>

        {/* Main graph */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.graphScrollView}
          contentContainerStyle={{ width: graphWidth }}
          scrollEnabled={!isActionActive} // Disable manual scroll during action
        >
          <Svg width={graphWidth} height={GRAPH_HEIGHT}>
            {/* Grid lines */}
            {gridFrequencies.map((freq, index) => (
              <Line key={`grid-${index}`} x1={0} y1={freqToY(freq)} x2={graphWidth} y2={freqToY(freq)} stroke="#f0f0f0" strokeWidth="1" />
            ))}

            {/* Start position indicator */}
            <Line
              x1={selectedStartTime * PIXELS_PER_SECOND}
              y1={0}
              x2={selectedStartTime * PIXELS_PER_SECOND}
              y2={GRAPH_HEIGHT}
              stroke="#000"
              strokeWidth="3"
              opacity="0.8"
            />

            {/* Current playback position (real-time bar) */}
            {isActionActive && (
              <Line
                x1={currentPlaybackTime * PIXELS_PER_SECOND}
                y1={0}
                x2={currentPlaybackTime * PIXELS_PER_SECOND}
                y2={GRAPH_HEIGHT}
                stroke="#FF3B30"
                strokeWidth="2"
              />
            )}

            {/* Reference pitches */}
            {referencePitches.map((point, index) => (
              <Circle key={`ref-${index}`} cx={point.time * PIXELS_PER_SECOND} cy={freqToY(point.freq)} r="4" fill="#34C759" opacity="0.8" />
            ))}

            {/* User pitches */}
            {userPitches.map((pitch, index) => (
              <Circle key={`user-${index}`} cx={pitch.time * PIXELS_PER_SECOND} cy={freqToY(pitch.freq)} r="3" fill="#FF9500" />
            ))}
          </Svg>
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
          <Text style={styles.legendText}>Reference</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
          <Text style={styles.legendText}>Your Voice</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  title: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 12 },
  graphContainer: { flexDirection: 'row', backgroundColor: '#f9f9f9', borderRadius: 12, overflow: 'hidden' },
  yAxisLabels: { width: 40, height: GRAPH_HEIGHT, backgroundColor: '#f9f9f9', justifyContent: 'center', paddingLeft: 8 },
  yAxisLabel: { position: 'absolute', fontSize: 11, color: '#666', fontWeight: '500' },
  graphScrollView: { flex: 1, height: GRAPH_HEIGHT },
  legend: { flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 16, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#666' },
});
