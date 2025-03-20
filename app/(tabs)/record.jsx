import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Dimensions, TouchableOpacity } from 'react-native';
import Pitchy from 'react-native-pitchy';
import { useMicrophonePermission } from '../../hooks/use-microphone-permission';
import { Svg, Rect, Line, Circle, Path, Text as SvgText } from 'react-native-svg';

export default function App() {
  const permissionGranted = useMicrophonePermission();
  const [frequency, setFrequency] = useState(0);
  const [note, setNote] = useState('--');
  const [userPitches, setUserPitches] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedSong, setSelectedSong] = useState('example');
  
  // Example song data (frequency values in Hz over time)
  // In a real app, this would come from song analysis or a database
  const songData = {
    example: [
      { time: 0, note: 'C4', freq: 261.63 },
      { time: 1, note: 'D4', freq: 293.66 },
      { time: 2, note: 'E4', freq: 329.63 },
      { time: 3, note: 'F4', freq: 349.23 },
      { time: 4, note: 'G4', freq: 392.00 },
      { time: 5, note: 'G4', freq: 392.00 },
      { time: 6, note: 'A4', freq: 440.00 },
      { time: 7, note: 'A4', freq: 440.00 },
      { time: 8, note: 'G4', freq: 392.00 },
      { time: 9, note: 'F4', freq: 349.23 },
      { time: 10, note: 'E4', freq: 329.63 },
      { time: 11, note: 'D4', freq: 293.66 },
      { time: 12, note: 'C4', freq: 261.63 },
    ],
    // Add more songs here
  };
  
  const getNote = (freq) => {
    if (!freq || isNaN(freq) || freq <= 0) return '--';
    const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const A4 = 440;
    // Calculate semitones away from A4
    const semitonesFromA4 = 12 * Math.log2(freq / A4);
    if (isNaN(semitonesFromA4)) return '--';
    // A4 is 9 semitones above C4
    const noteIndex = Math.round(semitonesFromA4) + 9;
    // Make sure the index is positive for the modulo operation
    const normalizedIndex = ((noteIndex % 12) + 12) % 12;
    const octave = 4 + Math.floor(noteIndex / 12);
    const note = noteStrings[normalizedIndex];
    // Additional safety check
    if (!note) return '--';
    return `${note}${octave}`;
  };
  
  // Convert frequency to y-position on graph
  const freqToY = (freq) => {
    if (!freq || freq <= 0) return height;
    
    // Map log frequency to y position (higher notes at top of graph)
    // C3 (130.81 Hz) to C6 (1046.50 Hz) range
    const minFreq = 130.81; // C3
    const maxFreq = 1046.50; // C6
    const logMinFreq = Math.log2(minFreq);
    const logMaxFreq = Math.log2(maxFreq);
    
    const graphHeight = 250;
    const padding = 25;
    
    const logFreq = Math.log2(freq);
    const normalized = (logFreq - logMinFreq) / (logMaxFreq - logMinFreq);
    
    // Invert Y so higher frequencies are at the top
    return graphHeight - (normalized * (graphHeight - padding * 2) + padding);
  };
  
  useEffect(() => {
    Pitchy.init({
      bufferSize: 12000,
      minVolume: 50,
    });
    
    const subscription = Pitchy.addListener((data) => {
      const currentFreq = data.pitch || 0;
      
      setFrequency(currentFreq);
      setNote(getNote(currentFreq));
      
      // Add the current pitch to user pitches if recording
      if (isRecording && currentFreq > 0) {
        setUserPitches(prev => {
          const now = Date.now();
          const startTime = prev.length > 0 ? prev[0].timestamp : now;
          const secondsElapsed = (now - startTime) / 1000;
          
          return [...prev, { 
            freq: currentFreq,
            note: getNote(currentFreq),
            timestamp: now,
            time: secondsElapsed
          }];
        });
      }
    });
    
    return () => subscription.remove();
  }, [isRecording]);
  
  useEffect(() => {
    if (!permissionGranted) return;
    Pitchy.start();
    return () => Pitchy.stop();
  }, [permissionGranted]);
  
  const handleStartRecording = () => {
    setUserPitches([]);
    setIsRecording(true);
  };
  
  const handleStopRecording = () => {
    setIsRecording(false);
  };
  
  // Create the path string for the song melody line
  const createSongPath = () => {
    const song = songData[selectedSong];
    if (!song || song.length === 0) return '';
    
    const width = Dimensions.get('window').width * 0.9 - 40;
    const duration = song[song.length - 1].time;
    
    let path = `M ${(song[0].time / duration) * width} ${freqToY(song[0].freq)}`;
    
    for (let i = 1; i < song.length; i++) {
      const x = (song[i].time / duration) * width;
      const y = freqToY(song[i].freq);
      path += ` L ${x} ${y}`;
    }
    
    return path;
  };
  
  // Create the path string for the user's singing line
  const createUserPath = () => {
    if (userPitches.length === 0) return '';
    
    const width = Dimensions.get('window').width * 0.9 - 40;
    const duration = Math.max(
      userPitches[userPitches.length - 1]?.time || 0,
      songData[selectedSong][songData[selectedSong].length - 1].time
    );
    
    let path = `M ${(userPitches[0].time / duration) * width} ${freqToY(userPitches[0].freq)}`;
    
    for (let i = 1; i < userPitches.length; i++) {
      const x = (userPitches[i].time / duration) * width;
      const y = freqToY(userPitches[i].freq);
      path += ` L ${x} ${y}`;
    }
    
    return path;
  };
  
  // Draw note lines on the graph
  const renderNoteLines = () => {
    const notes = [
      { note: 'C3', freq: 130.81 },
      { note: 'E3', freq: 164.81 },
      { note: 'G3', freq: 196.00 },
      { note: 'C4', freq: 261.63 },
      { note: 'E4', freq: 329.63 },
      { note: 'G4', freq: 392.00 },
      { note: 'C5', freq: 523.25 },
      { note: 'E5', freq: 659.25 },
      { note: 'G5', freq: 783.99 },
      { note: 'C6', freq: 1046.50 }
    ];
    
    return notes.map((note, index) => (
      <Line 
        key={index}
        x1="0"
        y1={freqToY(note.freq)}
        x2={Dimensions.get('window').width * 0.9 - 40}
        y2={freqToY(note.freq)}
        stroke="#333"
        strokeWidth="1"
        strokeDasharray={note.note.includes('C') ? "0" : "5,5"}
      />
    ));
  };
  
  // Render note labels
  const renderNoteLabels = () => {
    const notes = [
      { note: 'C3', freq: 130.81 },
      { note: 'C4', freq: 261.63 },
      { note: 'C5', freq: 523.25 },
      { note: 'C6', freq: 1046.50 }
    ];
    
    return notes.map((note, index) => (
      <SvgText
        key={index}
        x="5"
        y={freqToY(note.freq) + 4}
        fill="#888"
        fontSize="10"
      >
        {note.note}
      </SvgText>
    ));
  };
  
  const { width, height } = Dimensions.get('window');
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Singing Coach</Text>
      </View>
      
      <View style={styles.noteDisplay}>
        <Text style={styles.noteText}>{note}</Text>
        <Text style={styles.frequencyText}>
          {frequency ? Math.round(frequency) + ' Hz' : '--'}
        </Text>
      </View>
      
      <View style={styles.graphContainer}>
        <Svg height="300" width={width * 0.9}>
          {/* Background */}
          <Rect x="0" y="0" width={width * 0.9} height="300" fill="#111" />
          
          {/* Note lines */}
          {renderNoteLines()}
          {renderNoteLabels()}
          
          {/* Target song melody */}
          <Path
            d={createSongPath()}
            stroke="#4CAF50"
            strokeWidth="3"
            fill="none"
          />
          
          {/* User's singing path */}
          <Path
            d={createUserPath()}
            stroke="#FF5722"
            strokeWidth="3"
            fill="none"
            strokeDasharray={isRecording ? "0" : "3,3"}
          />
          
          {/* Song note markers */}
          {songData[selectedSong].map((point, index) => (
            <Circle
              key={`song-${index}`}
              cx={(point.time / songData[selectedSong][songData[selectedSong].length - 1].time) * (width * 0.9 - 40)}
              cy={freqToY(point.freq)}
              r="4"
              fill="#4CAF50"
            />
          ))}
          
          {/* Legend */}
          <Rect x="10" y="10" width="100" height="40" fill="rgba(0,0,0,0.5)" rx="5" />
          <Line x1="20" y1="25" x2="50" y2="25" stroke="#4CAF50" strokeWidth="3" />
          <SvgText x="55" y="30" fill="#fff" fontSize="12">Target</SvgText>
          <Line x1="20" y1="45" x2="50" y2="45" stroke="#FF5722" strokeWidth="3" />
          <SvgText x="55" y="50" fill="#fff" fontSize="12">You</SvgText>
        </Svg>
      </View>
      
      <View style={styles.controls}>
        {!isRecording ? (
          <TouchableOpacity 
            style={[styles.button, styles.startButton]} 
            onPress={handleStartRecording}
          >
            <Text style={styles.buttonText}>Start Singing</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.button, styles.stopButton]} 
            onPress={handleStopRecording}
          >
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {!permissionGranted && (
        <Text style={styles.warning}>Microphone access needed</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  noteDisplay: {
    alignItems: 'center',
    marginBottom: 20,
  },
  noteText: {
    fontSize: 72,
    fontWeight: '800',
    color: '#00E676',
  },
  frequencyText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#888',
  },
  graphContainer: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  startButton: {
    backgroundColor: '#00E676',
  },
  stopButton: {
    backgroundColor: '#FF5722',
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  warning: {
    marginTop: 20,
    color: '#FF1744',
    fontSize: 16,
    fontWeight: '500',
  }
});