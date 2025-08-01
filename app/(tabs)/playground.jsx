import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMicrophonePermission } from '../../hooks/useMicrophonePermission';
import Pitchy from 'react-native-pitchy';
import { RefreshCw } from 'lucide-react-native';

// Helper to convert MIDI number to note name (e.g., 60 -> C4)
const midiToNoteName = (midi) => {
  if (midi < 0 || midi > 127) return '--';
  const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${noteStrings[noteIndex]}${octave}`;
};

// Helper to get note name from frequency
const getNoteFromFreq = (freq) => {
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

// Generates a random MIDI note between C3 (48) and C5 (72)
const generateRandomNote = () => {
  const minMidi = 48; // C3
  const maxMidi = 72; // C5
  const randomMidi = Math.floor(Math.random() * (maxMidi - minMidi + 1)) + minMidi;
  return {
    midi: randomMidi,
    name: midiToNoteName(randomMidi),
  };
};

export default function PlaygroundScreen() {
  const permissionGranted = useMicrophonePermission();
  const [targetNote, setTargetNote] = useState(generateRandomNote);
  const [userNote, setUserNote] = useState('--');
  const [isListening, setIsListening] = useState(false);

  const handleNewNote = useCallback(() => {
    setTargetNote(generateRandomNote());
    setUserNote('--');
  }, []);

  useFocusEffect(
    useCallback(() => {
      let pitchSubscription = null;
      let isMounted = true;
      const isListeningRef = { current: false };
  
      const startListening = async () => {
        if (!permissionGranted || isListeningRef.current) return;
  
        try {
          await Pitchy.init({ bufferSize: 2048, minVolume: 60 });
          pitchSubscription = Pitchy.addListener((data) => {
            if (!isMounted) return;
            if (data.pitch > 0) {
              setUserNote(getNoteFromFreq(data.pitch));
            } else {
              setUserNote('--');
            }
          });
          await Pitchy.start();
          isListeningRef.current = true;
          if (isMounted) setIsListening(true);
        } catch (error) {
          console.error('Error starting pitch detection:', error);
          isListeningRef.current = false;
          if (isMounted) setIsListening(false);
        }
      };
  
      const stopListening = async () => {
        if (!isListeningRef.current) return;
  
        try {
          await Pitchy.stop();
          pitchSubscription?.remove();
          isListeningRef.current = false;
          if (isMounted) setIsListening(false);
        } catch (error) {
          console.error('Error stopping pitch detection:', error);
        }
      };
  
      startListening();
  
      return () => {
        isMounted = false;
        stopListening();
      };
    }, [permissionGranted])
  );
  
  if (!permissionGranted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.title}>Microphone Access Required</Text>
          <Text style={styles.subtitle}>Please grant microphone permissions in your device settings.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isMatch = targetNote && userNote === targetNote.name;
  const userNoteColor = userNote === '--' ? '#666' : isMatch ? '#28a745' : '#dc3545';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Playground</Text>
          <Text style={styles.subtitle}>Practice hitting random notes.</Text>
        </View>

        <View style={styles.noteDisplayContainer}>
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Target Note</Text>
            <Text style={styles.targetNoteText}>{targetNote ? targetNote.name : '--'}</Text>
          </View>
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Your Note</Text>
            <Text style={[styles.userNoteText, { color: userNoteColor }]}>{userNote}</Text>
          </View>
        </View>

        <View style={styles.statusContainer}>
          {isListening ? (
            <Text style={styles.listeningText}>Listening...</Text>
          ) : (
            <Text style={styles.listeningText}>Not Listening</Text>
          )}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleNewNote}>
          <RefreshCw size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>New Note</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32, justifyContent: 'space-between', paddingBottom: 32 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  header: { marginBottom: 48, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#000', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666', lineHeight: 24, textAlign: 'center' },
  noteDisplayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 48,
  },
  noteBox: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    minWidth: 140,
  },
  noteLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  targetNoteText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#000',
  },
  userNoteText: {
    fontSize: 56,
    fontWeight: 'bold',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  listeningText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#333',
  },
  primaryButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
 