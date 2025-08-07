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
import { Play, Square, Pause, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useMicrophonePermission } from '../../hooks/useMicrophonePermission';
import Pitchy from 'react-native-pitchy';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { initialSongs } from '../../data/songdata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import TimelineSelector, { TIMELINE_WIDTH } from '../../components/TimelineSelector';
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

const isValidFrequency = (freq) => freq >= 100 && freq <= 800;

export default function PitchTrackerScreen() {
  const params = useLocalSearchParams();
  const { songId } = params;
  const permissionGranted = useMicrophonePermission();

  // Refs
  const pitchSubscriptionRef = useRef(null);
  const recordingActualStartTimeRef = useRef(0);
  const animationFrameIdRef = useRef(null);

  // Core state
  const [selectedSong, setSelectedSong] = useState(null);
  const [sound, setSound] = useState(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [originalReferencePitches, setOriginalReferencePitches] = useState([]);
  const [referencePitches, setReferencePitches] = useState([]);
  const [octaveShift, setOctaveShift] = useState(0);
  const [songSource, setSongSource] = useState('predefined'); // 'predefined' or 'user'

  // User interaction state
  const [selectedSeekTime, setSelectedSeekTime] = useState(0);
  const [currentDisplayTime, setCurrentDisplayTime] = useState(0);

  // Recording state
  const [userPitches, setUserPitches] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [userRecordingUri, setUserRecordingUri] = useState(null);

  // Playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [userSound, setUserSound] = useState(null);
  const [isPlayingUserRecording, setIsPlayingUserRecording] = useState(false);

  // Animated scrubber position
  const scrubberPosition = useSharedValue(0);

  // Refs to hold latest state for animation loop to prevent stale closures
  const isRecordingRef = useRef(isRecording);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  const selectedSeekTimeRef = useRef(selectedSeekTime);
  useEffect(() => { selectedSeekTimeRef.current = selectedSeekTime; }, [selectedSeekTime]);

  // Load song data from both sources
  const loadSongData = async () => {
    try {
      // First try to find in user songs
      const storedSongs = await AsyncStorage.getItem('songs');
      const userSongs = storedSongs ? JSON.parse(storedSongs) : [];
      
      let song = userSongs.find(s => s.id === songId);
      let source = 'user';
      
      // If not found in user songs, check predefined songs
      if (!song) {
        song = initialSongs.find(s => s.id === songId);
        source = 'predefined';
      }
      
      // Fallback to first predefined song if no songId provided
      if (!song && !songId) {
        song = initialSongs[0];
        source = 'predefined';
      }
      
      if (song) {
        console.log(`Loading song from ${source}:`, song.title);
        setSelectedSong(song);
        setSongSource(source);
        
        const duration = parseDuration(song.duration);
        setTotalDuration(duration);
        
        // Handle pitches based on source
        let originalPitches = [];
        if (source === 'user' && song.pitches) {
          // User song with processed pitches
          originalPitches = song.pitches.map(p => ({ 
            time: p.time, 
            freq: typeof p.freq !== 'undefined' ? p.freq : midiToFreq(p.pitch) 
          }));
        } else if (source === 'predefined' && song.pitches) {
          // Predefined song with MIDI pitches
          originalPitches = song.pitches.map(p => ({ 
            time: p.time, 
            freq: midiToFreq(p.pitch) 
          }));
        }
        
        setOriginalReferencePitches(originalPitches);
        setReferencePitches(originalPitches);
        setOctaveShift(0);
        setCurrentDisplayTime(0);
        setSelectedSeekTime(0);
        scrubberPosition.value = withTiming(0);
        setUserPitches([]);
        setIsPlayingAudio(false);
        setIsRecording(false);
        setUserRecordingUri(null);
        
        // Clean up existing audio
        if (sound) {
          await sound.unloadAsync();
          setSound(null);
        }
        if (userSound) {
          await userSound.unloadAsync();
          setUserSound(null);
        }
      }
    } catch (error) {
      console.error('Error loading song data:', error);
    }
  };

  // Load song data when songId changes
  useEffect(() => {
    loadSongData();
  }, [songId]);

  // Apply octave shift
  useEffect(() => {
    if (originalReferencePitches.length > 0) {
      const shiftFactor = Math.pow(2, octaveShift);
      const shiftedPitches = originalReferencePitches.map(p => ({
        ...p,
        freq: p.freq * shiftFactor,
      }));
      setReferencePitches(shiftedPitches);
    }
  }, [octaveShift, originalReferencePitches]);

  // Audio setup
  useEffect(() => {
    const setupAudio = async () => {
      if (!selectedSong) return;
      
      try {
        await sound?.unloadAsync();
        
        let audioSource;
        if (songSource === 'user' && selectedSong.filename) {
          // User song with audio file
          audioSource = { uri: selectedSong.filename };
          console.log('Loading user audio from:', selectedSong.filename);
        } else if (songSource === 'predefined' && selectedSong.filename) {
          // Predefined song
          audioSource = selectedSong.filename;
          console.log('Loading predefined audio:', selectedSong.filename);
        } else {
          console.log('No audio file available for this song');
          return;
        }
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          audioSource,
          { shouldPlay: false, progressUpdateIntervalMillis: 30 }
        );
        setSound(newSound);
        newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
        console.log('Audio loaded successfully');
      } catch (error) { 
        console.error('Error loading audio:', error); 
        // Don't set sound if loading fails
        setSound(null);
      }
    };
    setupAudio();
    return () => { sound?.unloadAsync(); };
  }, [selectedSong, songSource]);

  // Playback status handlers
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded && !isRecordingRef.current) {
      const positionSeconds = status.positionMillis / 1000;
      setCurrentDisplayTime(positionSeconds);
      setIsPlayingAudio(status.isPlaying);
      scrubberPosition.value = withTiming((positionSeconds / totalDuration) * TIMELINE_WIDTH, { duration: 30 });
      if (status.didJustFinish) {
        setIsPlayingAudio(false);
        sound.setPositionAsync(selectedSeekTimeRef.current * 1000);
        setCurrentDisplayTime(selectedSeekTimeRef.current);
        scrubberPosition.value = withTiming((selectedSeekTimeRef.current / totalDuration) * TIMELINE_WIDTH);
      }
    }
  }, [totalDuration, sound]);

  const onUserPlaybackStatusUpdate = useCallback(async (status) => {
    if (!status.isLoaded) {
      if (status.error) console.error(`User playback error: ${status.error}`);
      return;
    }

    const positionSeconds = status.positionMillis / 1000;
    const displayTime = selectedSeekTimeRef.current + positionSeconds;
    setCurrentDisplayTime(displayTime);
    setIsPlayingUserRecording(status.isPlaying);
    scrubberPosition.value = withTiming((displayTime / totalDuration) * TIMELINE_WIDTH, { duration: 30 });

    if (status.didJustFinish) {
      setIsPlayingUserRecording(false);
      setCurrentDisplayTime(selectedSeekTimeRef.current);
      scrubberPosition.value = withTiming((selectedSeekTimeRef.current / totalDuration) * TIMELINE_WIDTH);
      try {
        await userSound?.stopAsync();
        await userSound?.setPositionAsync(0);
      } catch (error) {
        console.error('Error stopping/resetting user sound:', error);
      }
    }
  }, [totalDuration, userSound]);

  // Timeline selector handler
  const handleTimelineChange = (newTime) => {
    if (!isPlayingAudio && !isRecording && !isPlayingUserRecording) {
      setSelectedSeekTime(newTime);
      setCurrentDisplayTime(newTime);
      scrubberPosition.value = withTiming((newTime / totalDuration) * TIMELINE_WIDTH);
      sound?.setPositionAsync(newTime * 1000);
    }
  };

  // Pitch detection logic
  const stopPitchDetection = useCallback(async () => {
    try {
      await Pitchy.stop();
      pitchSubscriptionRef.current?.remove();
      pitchSubscriptionRef.current = null;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    } catch (error) { console.error('Error stopping pitch detection:', error); }
  }, []);

  const animateScrubberDuringRecording = useCallback(() => {
    if (isRecordingRef.current && totalDuration > 0) {
      const elapsed = (Date.now() - recordingActualStartTimeRef.current) / 1000;
      const newTime = selectedSeekTimeRef.current + elapsed;
      const clampedTime = Math.min(newTime, totalDuration);
      setCurrentDisplayTime(clampedTime);
      scrubberPosition.value = withTiming((clampedTime / totalDuration) * TIMELINE_WIDTH, { duration: 30 });
      if (clampedTime >= totalDuration) {
        handleRecord(); // Auto-stop
      } else {
        animationFrameIdRef.current = requestAnimationFrame(animateScrubberDuringRecording);
      }
    }
  }, [totalDuration]);

  const startPitchDetection = useCallback(async () => {
    try {
      await Pitchy.init({ bufferSize: 2048, minVolume: 60 });
      recordingActualStartTimeRef.current = Date.now();
      animationFrameIdRef.current = requestAnimationFrame(animateScrubberDuringRecording);
      pitchSubscriptionRef.current = Pitchy.addListener((data) => {
        if (isValidFrequency(data.pitch)) {
          const elapsed = (Date.now() - recordingActualStartTimeRef.current) / 1000;
          const pitchTime = selectedSeekTimeRef.current + elapsed;
          if (pitchTime <= totalDuration) {
            setUserPitches(prev => [...prev, { time: pitchTime, freq: data.pitch }]);
          }
        }
      });
      await Pitchy.start();
    } catch (error) { console.error('Error starting pitch detection:', error); }
  }, [animateScrubberDuringRecording, totalDuration]);

  // Control handlers
  const handlePlayPauseAudio = async () => {
    if (!sound || !selectedSong || isRecording || isPlayingUserRecording) return;
    try {
      if (isPlayingAudio) {
        await sound.pauseAsync();
      } else {
        await sound.playFromPositionAsync(selectedSeekTime * 1000);
      }
    } catch (error) { console.error('Error playing/pausing audio:', error); }
  };

  const handleRecord = async () => {
    try {
      if (isRecording) {
        setIsRecording(false);
        await stopPitchDetection();
        if (recording) {
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          setUserRecordingUri(uri);
          setRecording(null);
        }
        setCurrentDisplayTime(selectedSeekTime);
        scrubberPosition.value = withTiming((selectedSeekTime / totalDuration) * TIMELINE_WIDTH);
      } else {
        if (isPlayingAudio) await sound?.pauseAsync();
        if (isPlayingUserRecording) {
          await userSound?.pauseAsync();
          setIsPlayingUserRecording(false);
        }
        if (userSound) {
          await userSound.unloadAsync();
          setUserSound(null);
        }
        setUserPitches([]);
        setUserRecordingUri(null);
        setIsRecording(true);
        setCurrentDisplayTime(selectedSeekTime);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(newRecording);
        await startPitchDetection();
      }
    } catch (error) { console.error('Error handling record:', error); }
  };

  const handlePlayUserRecording = async () => {
    if (!userRecordingUri || isRecording || isPlayingAudio) return;
    try {
      if (isPlayingUserRecording && userSound) {
        await userSound.pauseAsync();
      } else {
        if (userSound) {
          await userSound.playAsync();
        } else {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: userRecordingUri },
            { shouldPlay: true, progressUpdateIntervalMillis: 30 }
          );
          setUserSound(newSound);
          newSound.setOnPlaybackStatusUpdate(onUserPlaybackStatusUpdate);
        }
      }
    } catch (error) { console.error('Error playing user recording:', error); }
  };

  const handleOctaveUp = () => setOctaveShift(prev => prev + 1);
  const handleOctaveDown = () => setOctaveShift(prev => prev - 1);

  // Cleanup
  useEffect(() => {
    return () => {
      pitchSubscriptionRef.current?.remove();
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      Pitchy.stop();
      sound?.unloadAsync();
      userSound?.unloadAsync();
    };
  }, [sound, userSound]);

  if (permissionGranted === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.title}>Microphone Access Required</Text>
          <Text style={styles.subtitle}>Please grant permission in your device settings.</Text>
        </View>
      </SafeAreaView>
    ); 
  }

  if (!selectedSong) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContainer}>
        <Text style={styles.title}>Loading Song...</Text>
      </View>
    </SafeAreaView>
  );

  const isActionActive = isRecording || isPlayingAudio || isPlayingUserRecording;
  const hasAudioFile = sound !== null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{selectedSong.title}</Text>
          <Text style={styles.subtitle}>by {selectedSong.artist}</Text>
        </View>

        <TimelineSelector
          currentTime={currentDisplayTime}
          totalDuration={totalDuration}
          onTimeChange={handleTimelineChange}
          scrubberPosition={scrubberPosition}
        />

        <PitchVisualizer
          referencePitches={referencePitches}
          userPitches={userPitches}
          currentPlaybackTime={currentDisplayTime}
          totalDuration={totalDuration}
          selectedStartTime={selectedSeekTime}
          isActionActive={isActionActive}
        />

        <View style={styles.controls}>
          {hasAudioFile ? (
            <TouchableOpacity
              style={[styles.primaryButton, (isRecording || isPlayingUserRecording) && styles.disabledButton]}
              onPress={handlePlayPauseAudio}
              disabled={isRecording || isPlayingUserRecording}
            >
              {isPlayingAudio ? <Pause size={20} color="#fff" /> : <Play size={20} color="#fff" />}
              <Text style={styles.primaryButtonText}>{isPlayingAudio ? 'Pause' : 'Play Audio'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noAudioButton}>
              <Text style={styles.noAudioButtonText}>No Audio File</Text>
              <Text style={styles.noAudioButtonSubtext}>Upload song with audio to play</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, isRecording && styles.recordingButton, (isPlayingAudio || isPlayingUserRecording) && styles.disabledButton]}
            onPress={handleRecord}
            disabled={isPlayingAudio || isPlayingUserRecording}
          >
            {isRecording ? <Square size={20} color="#fff" /> : <Play size={20} color="#fff" />}
            <Text style={styles.primaryButtonText}>{isRecording ? 'Stop' : 'Record'}</Text>
          </TouchableOpacity>

          {userRecordingUri && (
            <TouchableOpacity
              style={[styles.primaryButton, styles.playMineButton, (isRecording || isPlayingAudio) && styles.disabledButton]}
              onPress={handlePlayUserRecording}
              disabled={isRecording || isPlayingAudio}
            >
              {isPlayingUserRecording ? <Pause size={20} color="#fff" /> : <Play size={20} color="#fff" />}
              <Text style={styles.primaryButtonText}>{isPlayingUserRecording ? 'Pause' : 'Play Mine'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.octaveControls}>
          <TouchableOpacity onPress={handleOctaveDown} style={styles.octaveButton} disabled={isActionActive}>
            <ChevronDown size={24} color={isActionActive ? '#ccc' : '#000'} />
          </TouchableOpacity>
          <Text style={styles.octaveText}>Octave: {octaveShift > 0 ? `+${octaveShift}` : octaveShift}</Text>
          <TouchableOpacity onPress={handleOctaveUp} style={styles.octaveButton} disabled={isActionActive}>
            <ChevronUp size={24} color={isActionActive ? '#ccc' : '#000'} />
          </TouchableOpacity>
        </View>

        {!hasAudioFile && referencePitches.length > 0 && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Pitch Data Available</Text>
            <Text style={styles.infoText}>
              This song has pitch reference data for practice, but no audio file. 
              You can still record your voice and compare against the reference pitches.
            </Text>
          </View>
        )}

        {!hasAudioFile && referencePitches.length === 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Limited Functionality</Text>
            <Text style={styles.warningText}>
              This song has no audio file or pitch data. You can record your voice, 
              but there won't be reference pitches to compare against.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 50 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  header: { paddingTop: 32, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#000', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 20, textAlign: 'center', marginBottom: 8 },
  statusRow: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  statusText: { fontSize: 12, color: '#999', textAlign: 'center' },
  noAudioText: { color: '#FF6B6B' },
  controls: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 },
  primaryButton: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingButton: { backgroundColor: '#FF3B30' },
  playMineButton: { backgroundColor: '#5856D6' },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  noAudioButton: { 
    backgroundColor: '#f8f9fa', 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 8, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  noAudioButtonText: { color: '#6c757d', fontSize: 16, fontWeight: '600' },
  noAudioButtonSubtext: { color: '#adb5bd', fontSize: 12, marginTop: 2 },
  octaveControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 16, marginBottom: 32 },
  octaveButton: { padding: 10, backgroundColor: '#f0f0f0', borderRadius: 50 },
  octaveText: { fontSize: 16, fontWeight: '600', color: '#333', minWidth: 90, textAlign: 'center' },
  infoBox: {
    backgroundColor: '#e8f4f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});