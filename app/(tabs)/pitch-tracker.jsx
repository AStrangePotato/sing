import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Play, Square, Pause, ChevronUp, ChevronDown, Ear, Music4 } from 'lucide-react-native';
import { useMicrophonePermission } from '../../hooks/useMicrophonePermission';
import Pitchy from 'react-native-pitchy';
import { useLocalSearchParams } from 'expo-router';
import { initialSongs } from '../../data/songdata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import TimelineSelector, { TIMELINE_WIDTH } from '../../components/TimelineSelector';
import PitchVisualizer from '../../components/PitchVisualizer';
import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';

// Helper functions
const midiToFreq = (midiNote) => 440 * Math.pow(2, (midiNote - 69) / 12);
const parseDuration = (durationString) => {
  const parts = durationString.split(':');
  return parts.length === 2 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : 0;
};
const isValidFrequency = (freq) => freq >= 100 && freq <= 800;

export default function PitchTrackerScreen() {
  const params = useLocalSearchParams();
  const { songId } = params;
  const permissionGranted = useMicrophonePermission();

  // Refs
  const pitchSubscriptionRef = useRef(null);
  const referenceSound = useRef(null);
  const userSound = useRef(null);
  const recording = useRef(null);
  const recordingTimerRef = useRef(null);

  // Core state
  const [selectedSong, setSelectedSong] = useState(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [originalReferencePitches, setOriginalReferencePitches] = useState([]);
  const [referencePitches, setReferencePitches] = useState([]);
  const [octaveShift, setOctaveShift] = useState(0);
  const [referenceAudioUri, setReferenceAudioUri] = useState(null);

  // User interaction state
  const [selectedSeekTime, setSelectedSeekTime] = useState(0);
  const [currentDisplayTime, setCurrentDisplayTime] = useState(0);

  // Recording state
  const [userPitches, setUserPitches] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [userRecordingUri, setUserRecordingUri] = useState(null);
  const [userRecordingDuration, setUserRecordingDuration] = useState(0);

  // Playback state
  const [isPlayingReference, setIsPlayingReference] = useState(false);
  const [isPlayingUser, setIsPlayingUser] = useState(false);
  const [isPlayingBoth, setIsPlayingBoth] = useState(false);

  // Animated scrubber position
  const scrubberPosition = useSharedValue(0);

  const onPlaybackStatusUpdate = async (status) => {
    if (!status.isLoaded) return;

    const positionSeconds = status.positionMillis / 1000;
    setCurrentDisplayTime(positionSeconds);
    scrubberPosition.value = withTiming((positionSeconds / totalDuration) * TIMELINE_WIDTH, { duration: 100 });

    if (status.didJustFinish) {
      await userSound.current?.stopAsync();
      await referenceSound.current?.setVolumeAsync(1.0); // Reset volume
      setIsPlayingReference(false);
      setIsPlayingUser(false);
      setIsPlayingBoth(false);
      setCurrentDisplayTime(selectedSeekTime);
      scrubberPosition.value = withTiming((selectedSeekTime / totalDuration) * TIMELINE_WIDTH);
    }
  };
  
  const onUserPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;

    const userPositionSeconds = status.positionMillis / 1000;
    const newDisplayTime = selectedSeekTime + userPositionSeconds;
    setCurrentDisplayTime(newDisplayTime);
    scrubberPosition.value = withTiming((newDisplayTime / totalDuration) * TIMELINE_WIDTH, { duration: 100 });

    if (status.didJustFinish) {
      setIsPlayingUser(false);
      setCurrentDisplayTime(selectedSeekTime);
      scrubberPosition.value = withTiming((selectedSeekTime / totalDuration) * TIMELINE_WIDTH);
    }
  };

  const loadSongData = async () => {
    try {
      await referenceSound.current?.unloadAsync();
      await userSound.current?.unloadAsync();
      if (recording.current) {
        await recording.current.stopAndUnloadAsync();
        recording.current = null;
      }
      
      const storedSongs = await AsyncStorage.getItem('songs');
      const userSongs = storedSongs ? JSON.parse(storedSongs) : [];
      let song = userSongs.find(s => s.id === songId) || initialSongs.find(s => s.id === songId) || initialSongs[0];
      let source = userSongs.find(s => s.id === songId) ? 'user' : 'predefined';

      if (song) {
        setSelectedSong(song);
        const duration = parseDuration(song.duration);
        setTotalDuration(duration);

        let originalPitches = song.pitches.map(p => ({ time: p.time, freq: midiToFreq(p.pitch) }));
        setOriginalReferencePitches(originalPitches);
        setReferencePitches(originalPitches);

        setOctaveShift(0);
        setCurrentDisplayTime(0);
        setSelectedSeekTime(0);
        scrubberPosition.value = 0;
        setUserPitches([]);
        setIsPlayingReference(false);
        setIsPlayingUser(false);
        setIsPlayingBoth(false);
        setIsRecording(false);
        setUserRecordingUri(null);
        setUserRecordingDuration(0);

        let audioUri = null;
        if (source === 'user' && song.filename) {
          audioUri = song.filename;
        } else if (source === 'predefined' && song.filename) {
          const asset = Asset.fromModule(song.filename);
          await asset.downloadAsync();
          audioUri = asset.localUri || asset.uri;
        }
        setReferenceAudioUri(audioUri);

        if (audioUri) {
          const { sound } = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: false }, onPlaybackStatusUpdate);
          referenceSound.current = sound;
        }
      }
    } catch (error) {
      console.error('Error loading song data:', error);
    }
  };

  useEffect(() => { loadSongData(); }, [songId]);

  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);
      referenceSound.current?.unloadAsync();
      userSound.current?.unloadAsync();
      if (recording.current) {
        recording.current.stopAndUnloadAsync();
        recording.current = null;
      }
      Pitchy.stop();
    };
  }, []);

  useEffect(() => {
    if (originalReferencePitches.length > 0) {
      const shiftFactor = Math.pow(2, octaveShift);
      setReferencePitches(originalReferencePitches.map(p => ({ ...p, freq: p.freq * shiftFactor })));
    }
  }, [octaveShift, originalReferencePitches]);

  const handleTimelineChange = (newTime) => {
    if (!isRecording && !isPlayingReference && !isPlayingUser) {
      setSelectedSeekTime(newTime);
      setCurrentDisplayTime(newTime);
      scrubberPosition.value = withTiming((newTime / totalDuration) * TIMELINE_WIDTH);
      referenceSound.current?.setPositionAsync(newTime * 1000);
    }
  };

  const stopPitchDetection = useCallback(async () => {
    await Pitchy.stop();
    pitchSubscriptionRef.current?.remove();
  }, []);

  const startPitchDetection = useCallback(async (startTime) => {
    try {
      await Pitchy.init({ bufferSize: 2048, minVolume: 60 });
      const recordingStartTime = Date.now();
      pitchSubscriptionRef.current = Pitchy.addListener((data) => {
        if (isValidFrequency(data.pitch)) {
          const elapsedMillis = Date.now() - recordingStartTime;
          const pitchTime = startTime + (elapsedMillis / 1000);
          if (pitchTime <= totalDuration) {
            setUserPitches(prev => [...prev, { time: pitchTime, freq: data.pitch }]);
          }
        }
      });
      await Pitchy.start();
    } catch (error) { console.error('Error starting pitch detection:', error); }
  }, [totalDuration]);

  const handleRecord = async () => {
    if (isRecording) {
      // --- STOP RECORDING ---
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      await stopPitchDetection();
      
      try {
        await recording.current.stopAndUnloadAsync();
        const status = await recording.current.getStatusAsync();
        if (status.isDoneRecording) {
          setUserRecordingDuration(status.durationMillis / 1000);
          const uri = recording.current.getURI();
          setUserRecordingUri(uri);
        }
        recording.current = null;
      } catch (error) {
        console.error("Error stopping recording:", error);
        recording.current = null;
      }
      
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      setCurrentDisplayTime(selectedSeekTime);
      scrubberPosition.value = withTiming((selectedSeekTime / totalDuration) * TIMELINE_WIDTH);
    } else {
      // --- START RECORDING ---
      await referenceSound.current?.stopAsync();
      await userSound.current?.stopAsync();
      setIsPlayingReference(false);
      setIsPlayingUser(false);
      setIsPlayingBoth(false);
      setUserPitches([]);
      setUserRecordingUri(null);
      setUserRecordingDuration(0);
      
      setIsRecording(true);
      
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        
        const newRecording = new Audio.Recording();
        await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recording.current = newRecording;
        
        await recording.current.startAsync();
        await startPitchDetection(selectedSeekTime);

        const recordingStartTime = Date.now();
        recordingTimerRef.current = setInterval(() => {
          const elapsedSeconds = (Date.now() - recordingStartTime) / 1000;
          const newDisplayTime = selectedSeekTime + elapsedSeconds;
          if (newDisplayTime <= totalDuration) {
            setCurrentDisplayTime(newDisplayTime);
            scrubberPosition.value = withTiming((newDisplayTime / totalDuration) * TIMELINE_WIDTH, { duration: 100 });
          } else {
            handleRecord(); // Auto-stop
          }
        }, 100);

      } catch (err) {
        console.error('Failed to start recording', err);
        clearInterval(recordingTimerRef.current);
        setIsRecording(false);
        if (recording.current) {
          await recording.current.stopAndUnloadAsync();
          recording.current = null;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      }
    }
  };

  const handlePlayPauseReference = async () => {
    if (!referenceSound.current || isRecording || isPlayingBoth) return;
    if (isPlayingReference) {
      await referenceSound.current.pauseAsync();
      setIsPlayingReference(false);
    } else {
      await userSound.current?.stopAsync();
      setIsPlayingUser(false);
      await referenceSound.current.setPositionAsync(selectedSeekTime * 1000);
      await referenceSound.current.playAsync();
      setIsPlayingReference(true);
    }
  };

  const handlePlayPauseUser = async () => {
    if (!userRecordingUri || isRecording || isPlayingBoth) return;
    if (isPlayingUser) {
      await userSound.current.pauseAsync();
      setIsPlayingUser(false);
    } else {
      await referenceSound.current?.stopAsync();
      setIsPlayingReference(false);
      
      if (userSound.current) {
        await userSound.current.unloadAsync();
      }
      
      const { sound } = await Audio.Sound.createAsync({ uri: userRecordingUri }, null, onUserPlaybackStatusUpdate);
      userSound.current = sound;
      await userSound.current.playAsync();
      setIsPlayingUser(true);
    }
  };
  
  const handlePlayBothToggle = async () => {
    if (!referenceSound.current || !userRecordingUri || isRecording) return;

    if (isPlayingBoth) {
      // --- PAUSE BOTH ---
      await referenceSound.current?.pauseAsync();
      await userSound.current?.pauseAsync();
      await referenceSound.current?.setVolumeAsync(1.0); // Reset volume
      setIsPlayingBoth(false);
      setIsPlayingReference(false);
      setIsPlayingUser(false);
    } else {
      // --- PLAY BOTH ---
      await referenceSound.current?.stopAsync();
      await userSound.current?.stopAsync();
      setIsPlayingReference(false);
      setIsPlayingUser(false);

      await referenceSound.current.setPositionAsync(selectedSeekTime * 1000);
      
      if (userSound.current) {
        await userSound.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync({ uri: userRecordingUri });
      userSound.current = sound;
      
      await referenceSound.current.setVolumeAsync(0.5); // Reduce reference volume
      
      await userSound.current.playAsync();
      await referenceSound.current.playAsync();

      setIsPlayingBoth(true);
      setIsPlayingReference(true);
      setIsPlayingUser(true);
    }
  };

  if (permissionGranted === false) return <SafeAreaView style={styles.container}><Text style={styles.title}>Microphone Access Required</Text></SafeAreaView>;
  if (!selectedSong) return <SafeAreaView style={styles.container}><Text style={styles.title}>Loading Song...</Text></SafeAreaView>;

  const isActionActive = isRecording || isPlayingReference || isPlayingUser;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          {referenceAudioUri && (
            <TouchableOpacity style={[styles.primaryButton, isActionActive && !isPlayingReference && styles.disabledButton]} onPress={handlePlayPauseReference} disabled={isActionActive && !isPlayingReference}>
              {isPlayingReference && !isPlayingBoth ? <Pause size={20} color="#fff" /> : <Play size={20} color="#fff" />}
              <Text style={styles.primaryButtonText}>{isPlayingReference && !isPlayingBoth ? 'Pause' : 'Play Ref'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.primaryButton, isRecording && styles.recordingButton, isActionActive && !isRecording && styles.disabledButton]} onPress={handleRecord} disabled={isActionActive && !isRecording}>
            {isRecording ? <Square size={20} color="#fff" /> : <Ear size={20} color="#fff" />}
            <Text style={styles.primaryButtonText}>{isRecording ? 'Stop' : 'Record'}</Text>
          </TouchableOpacity>

          {userRecordingUri && (
            <>
              <TouchableOpacity style={[styles.primaryButton, styles.playMineButton, isActionActive && !isPlayingUser && styles.disabledButton]} onPress={handlePlayPauseUser} disabled={isActionActive && !isPlayingUser}>
                {isPlayingUser && !isPlayingBoth ? <Pause size={20} color="#fff" /> : <Play size={20} color="#fff" />}
                <Text style={styles.primaryButtonText}>Play Mine</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, styles.playBothButton, isActionActive && !isPlayingBoth && styles.disabledButton]} onPress={handlePlayBothToggle} disabled={isActionActive && !isPlayingBoth}>
                {isPlayingBoth ? <Pause size={20} color="#fff" /> : <Music4 size={20} color="#fff" />}
                <Text style={styles.primaryButtonText}>{isPlayingBoth ? 'Pause Both' : 'Play Both'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.octaveControls}>
          <TouchableOpacity onPress={() => setOctaveShift(p => p - 1)} style={styles.octaveButton} disabled={isActionActive}><ChevronDown size={24} color={isActionActive ? '#ccc' : '#000'} /></TouchableOpacity>
          <Text style={styles.octaveText}>Octave: {octaveShift > 0 ? `+${octaveShift}` : octaveShift}</Text>
          <TouchableOpacity onPress={() => setOctaveShift(p => p + 1)} style={styles.octaveButton} disabled={isActionActive}><ChevronUp size={24} color={isActionActive ? '#ccc' : '#000'} /></TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 50, paddingBottom: 10 },
  header: { paddingTop: 32, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#000', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 20, textAlign: 'center', marginBottom: 8 },
  controls: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 },
  primaryButton: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingButton: { backgroundColor: '#FF3B30' },
  playMineButton: { backgroundColor: '#5856D6' },
  playBothButton: { backgroundColor: '#34C759' },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  noAudioButton: { backgroundColor: '#f8f9fa', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e9ecef' },
  noAudioButtonText: { color: '#6c757d', fontSize: 16, fontWeight: '600' },
  octaveControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 16, marginBottom: 32 },
  octaveButton: { padding: 10, backgroundColor: '#f0f0f0', borderRadius: 50 },
  octaveText: { fontSize: 16, fontWeight: '600', color: '#333', minWidth: 90, textAlign: 'center' },
});
