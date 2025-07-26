// PitchTrackerScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Play, Square, Pause } from 'lucide-react-native'; // Removed RotateCcw
import { useMicrophonePermission } from '../../hooks/useMicrophonePermission';
import Pitchy from 'react-native-pitchy';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { initialSongs } from '../../data/songdata';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import TimelineSelector from '../../components/TimelineSelector';
import PitchVisualizer from '../../components/PitchVisualizer';

// Helper functions
const midiToFreq = (midiNote) => 440 * Math.pow(2, (midiNote - 69) / 12);

const parseDuration = (durationString) => {
  const parts = durationString.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
};

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

const isValidFrequency = (freq) => freq >= 100 && freq <= 800;

export default function PitchTrackerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { songId } = params;
  const permissionGranted = useMicrophonePermission();

  // Refs
  const pitchSubscriptionRef = useRef(null);
  const recordingActualStartTimeRef = useRef(0); // Stores the exact system timestamp when recording started
  const animationFrameIdRef = useRef(null);

  // Core state
  const [selectedSong, setSelectedSong] = useState(null);
  const [sound, setSound] = useState(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [referencePitches, setReferencePitches] = useState([]);

  // User interaction state
  const [selectedSeekTime, setSelectedSeekTime] = useState(0); // The time user has manually selected on the timeline
  const [currentDisplayTime, setCurrentDisplayTime] = useState(0); // The time currently shown on the timeline/visualizer

  // Recording state
  const [frequency, setFrequency] = useState(0);
  const [note, setNote] = useState('--');
  const [userPitches, setUserPitches] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  // Playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Animated scrubber position - controlled externally by this component, passed to TimelineSelector
  const scrubberPosition = useSharedValue(0);

  // Load song data
  useEffect(() => {
    const loadSong = () => {
      const song = songId
        ? initialSongs.find(s => s.id === songId)
        : initialSongs[0]; // Fallback to first song if no songId

      if (song) {
        setSelectedSong(song);
        const duration = parseDuration(song.duration);
        setTotalDuration(duration);

        const convertedPitches = song.pitches.map(p => ({
          time: p.time,
          freq: midiToFreq(p.pitch),
        }));
        setReferencePitches(convertedPitches);
        // Reset state for new song
        setCurrentDisplayTime(0);
        setSelectedSeekTime(0);
        scrubberPosition.value = withTiming(0);
        setUserPitches([]);
        setIsPlayingAudio(false);
        setIsRecording(false);
        if (sound) { // If a sound object exists from a previous song, stop it
          sound.stopAsync().catch(e => console.error("Error stopping old sound:", e));
        }
      }
    };

    loadSong();
  }, [songId]);

  // Audio setup
  useEffect(() => {
    const setupAudio = async () => {
      if (!selectedSong?.filename) return;

      try {
        if (sound) {
          await sound.unloadAsync();
        }

        const { sound: newSound } = await Audio.Sound.createAsync(
          selectedSong.filename,
          { shouldPlay: false }
        );

        setSound(newSound);
        newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      } catch (error) {
        console.error('Error loading audio:', error);
      }
    };

    setupAudio();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [selectedSong]); // Re-run when selectedSong changes

  // Audio playback status handler
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded && !isRecording) { // Only update from audio if not recording
      const positionSeconds = status.positionMillis / 1000;
      setCurrentDisplayTime(positionSeconds);
      setIsPlayingAudio(status.isPlaying);

      const timelineWidth = 300; // Match TimelineSelector's width
      scrubberPosition.value = withTiming((positionSeconds / totalDuration) * timelineWidth, { duration: 50 });

      if (status.didJustFinish) {
        setIsPlayingAudio(false);
        // Reset to selectedSeekTime
        setCurrentDisplayTime(selectedSeekTime);
        scrubberPosition.value = withTiming((selectedSeekTime / totalDuration) * timelineWidth);
      }
    }
  }, [selectedSeekTime, totalDuration, isRecording]);

  // Timeline selector handlers
  const handleTimelineChange = (newTime) => {
    // Only allow changing seek time if not playing or recording
    if (!isPlayingAudio && !isRecording) {
      setSelectedSeekTime(newTime);
      setCurrentDisplayTime(newTime); // Update current display immediately
      const timelineWidth = 300;
      scrubberPosition.value = withTiming((newTime / totalDuration) * timelineWidth);
    }
  };

  // Function to update scrubber during recording
  const animateScrubberDuringRecording = useCallback(() => {
    if (isRecording && totalDuration > 0) { // Ensure totalDuration is valid
      const elapsedSinceRecordingStart = (Date.now() - recordingActualStartTimeRef.current) / 1000;
      const newCurrentDisplayTime = selectedSeekTime + elapsedSinceRecordingStart;

      // Clamp time to total duration
      const clampedTime = Math.min(newCurrentDisplayTime, totalDuration);

      setCurrentDisplayTime(clampedTime); // This updates the state that TimelineSelector consumes

      const timelineWidth = 300; // Match TimelineSelector's width
      scrubberPosition.value = withTiming((clampedTime / totalDuration) * timelineWidth, { duration: 50 });

      if (clampedTime >= totalDuration) {
        // If recording reaches the end of the song, stop it
        handleRecord(); // This will toggle isRecording and stop pitch detection
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      } else {
        animationFrameIdRef.current = requestAnimationFrame(animateScrubberDuringRecording);
      }
    }
  }, [isRecording, selectedSeekTime, totalDuration, handleRecord]);


  // Pitch detection
  const startPitchDetection = async () => {
    try {
      const config = {
        bufferSize: 4096,
        minVolume: 60,
      };

      await Pitchy.init(config);
      recordingActualStartTimeRef.current = Date.now(); // Mark the exact start of recording
      animationFrameIdRef.current = requestAnimationFrame(animateScrubberDuringRecording);

      const handlePitchDetected = (data) => {
        const detectedFreq = data.pitch;

        if (isValidFrequency(detectedFreq)) {
          setFrequency(detectedFreq);
          setNote(getNote(detectedFreq));

          const elapsedSinceRecordingStart = (Date.now() - recordingActualStartTimeRef.current) / 1000;
          const pitchRecordingTime = selectedSeekTime + elapsedSinceRecordingStart; // Time for pitch data

          if (pitchRecordingTime <= totalDuration) {
            setUserPitches(prev => [...prev, {
              time: pitchRecordingTime, // Store pitch data with its absolute song time
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
    } catch (error) {
      console.error('Error starting pitch detection:', error);
    }
  };

  const stopPitchDetection = async () => {
    try {
      await Pitchy.stop();

      if (pitchSubscriptionRef.current) {
        pitchSubscriptionRef.current.remove();
        pitchSubscriptionRef.current = null;
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }

      setFrequency(0);
      setNote('--');
    } catch (error) {
      console.error('Error stopping pitch detection:', error);
    }
  };

  // Control handlers
  const handlePlayPauseAudio = async () => {
    if (!sound) return;

    try {
      if (isRecording) { // If recording, stop it first
        await stopPitchDetection();
        setIsRecording(false);
      }

      if (isPlayingAudio) {
        await sound.pauseAsync();
      } else {
        await sound.setPositionAsync(selectedSeekTime * 1000); // Start from selected seek time
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error playing/pausing audio:', error);
    }
  };

  const handleRecord = async () => {
    try {
      if (isRecording) {
        // Stop recording
        setIsRecording(false);
        await stopPitchDetection(); // This stops pitch detection and the scrubber animation
        // After stopping, reset current display time to the selected seek time for next interaction
        setCurrentDisplayTime(selectedSeekTime);
        const timelineWidth = 300;
        scrubberPosition.value = withTiming((selectedSeekTime / totalDuration) * timelineWidth);
      } else {
        // Start recording
        if (isPlayingAudio) {
          await sound.pauseAsync(); // Pause audio if playing
          setIsPlayingAudio(false);
        }
        setUserPitches([]); // Clear previous user pitches
        setIsRecording(true);
        setCurrentDisplayTime(selectedSeekTime); // Ensure display time starts from seek time
        await startPitchDetection(); // This will also start the scrubber animation
      }
    } catch (error) {
      console.error('Error handling record:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pitchSubscriptionRef.current) {
        pitchSubscriptionRef.current.remove();
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      Pitchy.stop();
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]); // Dependency on 'sound' ensures cleanup happens correctly when sound object changes/unmounts

  // Permission check
  if (!permissionGranted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.title}>Microphone Access Required</Text>
          <Text style={styles.subtitle}>
            Please grant microphone permission to use pitch tracking features.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading check
  if (!selectedSong) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.title}>Loading Song...</Text>
          <Text style={styles.subtitle}>
            Please select a song from the Library tab.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/library')}>
            <Text style={styles.primaryButtonText}>Go to Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Pitch Practice</Text>
          <Text style={styles.subtitle}>
            {selectedSong.title} by {selectedSong.artist}
          </Text>
        </View>

        {/* Current Pitch Display */}
        <View style={styles.currentPitch}>
          <Text style={styles.noteText}>{note}</Text>
          <Text style={styles.frequencyText}>
            {frequency > 0 ? `${frequency.toFixed(1)} Hz` : 'No signal'}
          </Text>
        </View>

        {/* Timeline Selector */}
        <TimelineSelector
          currentTime={currentDisplayTime} // This state drives the scrubber's position
          totalDuration={totalDuration}
          onTimeChange={handleTimelineChange}
          scrubberPosition={scrubberPosition} // Pass shared value for direct animation
        />

        {/* Pitch Visualizer */}
        <PitchVisualizer
          referencePitches={referencePitches}
          userPitches={userPitches}
          currentPlaybackTime={currentDisplayTime} // Visualizer also uses currentDisplayTime
          totalDuration={totalDuration}
          selectedStartTime={selectedSeekTime} // Visualizer needs to know the start point
        />

        {/* Control Buttons */}
        <View style={styles.controls}>
          {/* Removed Reset Button and its related styles */}

          <TouchableOpacity
            style={[styles.primaryButton, isPlayingAudio && styles.playingButton]}
            onPress={handlePlayPauseAudio}
            disabled={isRecording} // Cannot play audio while recording
          >
            {isPlayingAudio ? (
              <Pause size={20} color="#fff" />
            ) : (
              <Play size={20} color="#fff" />
            )}
            <Text style={styles.primaryButtonText}>
              {isPlayingAudio ? 'Pause' : 'Play Audio'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, isRecording && styles.recordingButton]}
            onPress={handleRecord}
            disabled={isPlayingAudio} // Cannot record while playing audio
          >
            {isRecording ? (
              <Square size={20} color="#fff" />
            ) : (
              <Play size={20} color="#fff" />
            )}
            <Text style={styles.primaryButtonText}>
              {isRecording ? 'Stop' : 'Record'}
            </Text>
          </TouchableOpacity>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 24,
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
  controls: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  playingButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});