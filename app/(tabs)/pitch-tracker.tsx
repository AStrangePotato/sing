import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Play, Square, RotateCcw } from 'lucide-react-native';
import { Svg, Circle, Line } from 'react-native-svg';
import { useMicrophonePermission } from '../../hooks/useMicrophonePermission';
import Pitchy, { PitchyConfig, PitchyEventCallback } from 'react-native-pitchy';

const { width: screenWidth } = Dimensions.get('window');
const GRAPH_WIDTH = screenWidth - 48;
const GRAPH_HEIGHT = 250;
const PIXELS_PER_SECOND = 60;

export default function PitchTrackerScreen() {
  const permissionGranted = useMicrophonePermission();
  const [frequency, setFrequency] = useState(0);
  const [note, setNote] = useState('--');
  const [userPitches, setUserPitches] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const scrollViewRef = useRef(null);
  const pitchSubscriptionRef = useRef(null);
  const recordingStartTimeRef = useRef(0);
  const recordingStartPositionRef = useRef(0);

  const referencePitches = [
    { time: 0, freq: 261.63 },
    { time: 1, freq: 293.66 },
    { time: 2, freq: 329.63 },
    { time: 3, freq: 349.23 },
    { time: 4, freq: 392.00 },
    { time: 5, freq: 392.00 },
    { time: 6, freq: 440.00 },
    { time: 7, freq: 440.00 },
    { time: 8, freq: 392.00 },
    { time: 9, freq: 349.23 },
    { time: 10, freq: 329.63 },
    { time: 11, freq: 293.66 },
    { time: 12, freq: 261.63 },
  ];

  const totalDuration = 13;
  const totalWidth = totalDuration * PIXELS_PER_SECOND;

  const getNote = (freq) => {
    if (!freq || isNaN(freq) || freq <= 0) return '--';
    const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const A4 = 440;
    const semitonesFromA4 = 12 * Math.log2(freq / A4);
    if (isNaN(semitonesFromA4)) return '--';
    const noteIndex = Math.round(semitonesFromA4) + 9;
    const normalizedIndex = ((noteIndex % 12) + 12) % 12;
    const octave = 4 + Math.floor(noteIndex / 12);
    const note = noteStrings[normalizedIndex];
    if (!note) return '--';
    return `${note}${octave}`;
  };

  const isValidFrequency = (freq) => {
    return freq >= 100 && freq <= 800;
  };

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

  const handlePositionChange = (value) => {
    setCurrentPosition(value);
    setCurrentTime(value);
  };

  const startPitchDetection = async () => {
    const config: PitchyConfig = {
      bufferSize: 4096,
      minVolume: 60,
    };
    
    await Pitchy.init(config);
    
    recordingStartTimeRef.current = Date.now();
    recordingStartPositionRef.current = currentPosition;
    
    const handlePitchDetected: PitchyEventCallback = (data) => {
      const detectedFreq = data.pitch;
      
      if (isValidFrequency(detectedFreq)) {
        setFrequency(detectedFreq);
        setNote(getNote(detectedFreq));
        
        const elapsedSeconds = (Date.now() - recordingStartTimeRef.current) / 1000;
        const actualTime = recordingStartPositionRef.current + elapsedSeconds;
        
        if (actualTime <= totalDuration) {
          setUserPitches(prev => [...prev, {
            time: actualTime,
            freq: detectedFreq
          }]);
        }
      } else {
        setFrequency(0);
        setNote('--');
      }
    };
    
    pitchSubscriptionRef.current = Pitchy.addListener(handlePitchDetected);
    await Pitchy.start();
  };

  const stopPitchDetection = async () => {
    await Pitchy.stop();
    
    if (pitchSubscriptionRef.current) {
      pitchSubscriptionRef.current.remove();
      pitchSubscriptionRef.current = null;
    }
    
    setFrequency(0);
    setNote('--');
  };

  const handleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      stopPitchDetection();
    } else {
      setUserPitches([]);
      setCurrentTime(currentPosition);
      setIsRecording(true);
      startPitchDetection();
    }
  };

  const handleReset = () => {
    setIsRecording(false);
    stopPitchDetection();
    setUserPitches([]);
    setCurrentTime(currentPosition);
    setFrequency(0);
    setNote('--');
  };

  const userPitchesInSection = userPitches.filter(pitch => 
    pitch.time >= currentPosition && pitch.time <= totalDuration
  );

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 0.1;
          if (newTime >= totalDuration) {
            if (isLooping) {
              return currentPosition;
            } else {
              setIsRecording(false);
              stopPitchDetection();
              return totalDuration;
            }
          }
          return newTime;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isRecording, isLooping, currentPosition, totalDuration]);

  useEffect(() => {
    return () => {
      if (pitchSubscriptionRef.current) {
        pitchSubscriptionRef.current.remove();
      }
      Pitchy.stop();
    };
  }, []);

  useEffect(() => {
    if (scrollViewRef.current && isRecording) {
      const scrollX = Math.max(0, currentTime * PIXELS_PER_SECOND - GRAPH_WIDTH / 2);
      scrollViewRef.current.scrollTo({ x: scrollX, animated: true });
    }
  }, [currentTime, isRecording]);

  if (!permissionGranted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Microphone Access Required</Text>
          <Text style={styles.permissionText}>
            Please grant microphone permission to use pitch tracking features.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Pitch Practice</Text>
          <Text style={styles.subtitle}>
            Practice your singing with real-time pitch feedback
          </Text>
        </View>

        <View style={styles.currentPitch}>
          <Text style={styles.noteText}>{note}</Text>
          <Text style={styles.frequencyText}>
            {frequency > 0 ? `${frequency.toFixed(1)} Hz` : 'No signal'}
          </Text>
        </View>

        <View style={styles.sectionControls}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Practice Section</Text>
            <TouchableOpacity
              style={[styles.loopButton, isLooping && styles.loopButtonActive]}
              onPress={() => setIsLooping(!isLooping)}
            >
              <Text style={[styles.loopButtonText, isLooping && styles.loopButtonTextActive]}>
                {isLooping ? 'Loop On' : 'Loop Off'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.timelineContainer}>
            <Text style={styles.timelineLabel}>
              Position: {currentPosition.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </Text>
            <View style={styles.timelineWrapper}>
              <View style={styles.timelineTrack}>
                <View 
                  style={[
                    styles.timelineProgress, 
                    { width: `${(currentPosition / totalDuration) * 100}%` }
                  ]} 
                />
                <View 
                  style={[
                    styles.timelineScrubber,
                    { left: `${(currentPosition / totalDuration) * 100}%` }
                  ]}
                />
              </View>
              <TouchableOpacity
                style={styles.timelineSlider}
                onPress={(event) => {
                  const { locationX } = event.nativeEvent;
                  const percentage = locationX / (screenWidth - 48);
                  const newPosition = Math.max(0, Math.min(totalDuration, percentage * totalDuration));
                  handlePositionChange(newPosition);
                }}
                activeOpacity={1}
              />
            </View>
          </View>
        </View>

        <View style={styles.visualizerContainer}>
          <Text style={styles.visualizerTitle}>Pitch Visualization</Text>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.graphScrollView}
            contentContainerStyle={{ width: Math.max(GRAPH_WIDTH, totalWidth + 100) }}
          >
            <Svg width={Math.max(GRAPH_WIDTH, totalWidth + 100)} height={GRAPH_HEIGHT}>
              {[130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 277.18, 311.13, 329.63].map((freq, index) => (
                <Line
                  key={`grid-${index}`}
                  x1={0}
                  y1={freqToY(freq)}
                  x2={Math.max(GRAPH_WIDTH, totalWidth + 100)}
                  y2={freqToY(freq)}
                  stroke="#f5f5f5"
                  strokeWidth="1"
                />
              ))}
              
              {isRecording && (
                <Line
                  x1={currentTime * PIXELS_PER_SECOND}
                  y1={0}
                  x2={currentTime * PIXELS_PER_SECOND}
                  y2={GRAPH_HEIGHT}
                  stroke="#ff6b6b"
                  strokeWidth="2"
                  opacity="0.7"
                />
              )}
              
              {referencePitches.map((point, index) => {
                const adjustedTime = point.time;
                return (
                  <Circle
                    key={`ref-${index}`}
                    cx={adjustedTime * PIXELS_PER_SECOND}
                    cy={freqToY(point.freq)}
                    r="4"
                    fill="#d1d5db"
                    opacity="0.8"
                  />
                );
              })}
              
              {userPitchesInSection.map((pitch, index) => (
                <Circle
                  key={`user-${index}`}
                  cx={pitch.time * PIXELS_PER_SECOND}
                  cy={freqToY(pitch.freq)}
                  r="3"
                  fill="#000"
                />
              ))}
            </Svg>
          </ScrollView>
          
          <View style={styles.yAxisLabels}>
            {[
              { note: 'E4', freq: 329.63 },
              { note: 'D4', freq: 293.66 },
              { note: 'C4', freq: 261.63 },
              { note: 'A3', freq: 220.00 },
              { note: 'G3', freq: 196.00 },
              { note: 'F3', freq: 174.61 },
              { note: 'D3', freq: 146.83 },
              { note: 'C3', freq: 130.81 },
            ].map((item, index) => (
              <Text
                key={index}
                style={[
                  styles.yAxisLabel,
                  { top: freqToY(item.freq) - 8 }
                ]}
              >
                {item.note}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#d1d5db' }]} />
            <Text style={styles.legendText}>Reference</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#000' }]} />
            <Text style={styles.legendText}>Your Voice</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
            <RotateCcw size={20} color="#666" />
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.primaryButton, isRecording && styles.recordingButton]} 
            onPress={handleRecord}
          >
            {isRecording ? (
              <Square size={20} color="#fff" />
            ) : (
              <Play size={20} color="#fff" />
            )}
            <Text style={styles.primaryButtonText}>
              {isRecording ? 'Stop' : 'Practice'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stats}>
          <Text style={styles.statsTitle}>Session Stats</Text>
          <Text style={styles.statsText}>
            Recorded pitches: {userPitchesInSection.length}
          </Text>
          <Text style={styles.statsText}>
            Song duration: {totalDuration.toFixed(1)}s
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 32,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  currentPitch: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  noteText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  frequencyText: {
    fontSize: 14,
    color: '#666',
  },
  sectionControls: {
    marginBottom: 32,
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  loopButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  loopButtonActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  loopButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  loopButtonTextActive: {
    color: '#fff',
  },
  timelineContainer: {
    marginBottom: 12,
  },
  timelineLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  timelineWrapper: {
    position: 'relative',
    height: 40,
    justifyContent: 'center',
  },
  timelineTrack: {
    position: 'absolute',
    width: '100%',
    height: 4,
    backgroundColor: '#e5e5e5',
    borderRadius: 2,
    top: 18,
  },
  timelineProgress: {
    height: '100%',
    backgroundColor: '#000',
    borderRadius: 2,
  },
  timelineScrubber: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    backgroundColor: '#000',
    borderRadius: 8,
    marginLeft: -8,
  },
  timelineSlider: {
    position: 'absolute',
    width: '100%',
    height: 40,
  },
  timelineThumb: {
    backgroundColor: '#000',
    width: 16,
    height: 16,
  },
  visualizerContainer: {
    marginBottom: 24,
    position: 'relative',
  },
  visualizerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  graphScrollView: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    height: GRAPH_HEIGHT,
  },
  yAxisLabels: {
    position: 'absolute',
    left: -40,
    top: 0,
    height: GRAPH_HEIGHT,
  },
  yAxisLabel: {
    position: 'absolute',
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingButton: {
    backgroundColor: '#dc2626',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  stats: {
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 32,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});