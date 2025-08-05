import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ScrollView,
  ActivityIndicator 
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from '@expo/vector-icons';

export default function AddSongScreen() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ 
        type: "audio/*",
        copyToCacheDirectory: true
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedFile = result.assets[0];
        setFile(selectedFile);
        
        // Auto-fill title if not already filled
        if (!title && selectedFile.name) {
          const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
          setTitle(nameWithoutExt);
        }
      }
    } catch (error) {
      console.error("Error picking file:", error);
      Alert.alert("Error", "Failed to pick file. Please try again.");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const addSong = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a song title");
      return;
    }
    if (!artist.trim()) {
      Alert.alert("Error", "Please enter an artist name");
      return;
    }
    if (!file) {
      Alert.alert("Error", "Please select an audio file");
      return;
    }

    setLoading(true);
    try {
      // 1. Upload to server
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        type: file.mimeType || "audio/mpeg",
        name: file.name || "audio.mp3",
      } as any);

      const res = await fetch("http://34.61.43.132:5000/process", {
        method: "POST",
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Server error");

      // 2. Copy audio file to app storage
      const fileName = file.name || `${Date.now()}.mp3`;
      const newPath = FileSystem.documentDirectory + fileName;
      await FileSystem.copyAsync({ from: file.uri, to: newPath });

      // 3. Create song object
      const song = {
        id: Date.now().toString(), // Better unique ID
        title: title.trim(),
        artist: artist.trim(),
        duration: new Date(json.duration * 1000).toISOString().substr(14, 5),
        filename: newPath,
        pitches: json.pitches,
        dateAdded: new Date().toISOString(),
      };

      // 4. Save to AsyncStorage
      const existing = await AsyncStorage.getItem("songs");
      const songs = existing ? JSON.parse(existing) : [];
      songs.push(song);
      await AsyncStorage.setItem("songs", JSON.stringify(songs));

      Alert.alert("Success", "Song added to your library!", [
        {
          text: "OK",
          onPress: () => {
            setTitle("");
            setArtist("");
            setFile(null);
          }
        }
      ]);
    } catch (err: any) {
      console.error("Error adding song:", err);
      Alert.alert("Error", err.message || "Failed to add song. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text style={styles.title}>Add New Song</Text>
        <Text style={styles.subtitle}>Fill in the details and select an audio file</Text>

        {/* Song Title Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Song Title *</Text>
          <TextInput
            placeholder="Enter song title"
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#999"
            autoCapitalize="words"
          />
        </View>

        {/* Artist Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Artist *</Text>
          <TextInput
            placeholder="Enter artist name"
            style={styles.input}
            value={artist}
            onChangeText={setArtist}
            placeholderTextColor="#999"
            autoCapitalize="words"
          />
        </View>

        {/* File Picker */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Audio File *</Text>
          <TouchableOpacity 
            style={[styles.fileButton, file && styles.fileButtonSelected]} 
            onPress={pickFile}
            disabled={loading}
          >
            <View style={styles.fileButtonContent}>
              <Ionicons 
                name={file ? "musical-note" : "add-circle-outline"} 
                size={24} 
                color={file ? "#007AFF" : "#666"} 
              />
              <View style={styles.fileTextContainer}>
                <Text style={[styles.fileButtonText, file && styles.fileButtonTextSelected]}>
                  {file ? file.name : "Select Audio File"}
                </Text>
                {file && (
                  <Text style={styles.fileDetails}>
                    {formatFileSize(file.size)} • {file.mimeType || 'Audio file'}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Add Song Button */}
        <TouchableOpacity
          style={[
            styles.addButton, 
            loading && styles.addButtonLoading,
            (!title.trim() || !artist.trim() || !file) && styles.addButtonDisabled
          ]}
          onPress={addSong}
          disabled={loading || !title.trim() || !artist.trim() || !file}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.addButtonText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.addButtonText}>Add Song to Library</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            * Required fields. Supported formats: MP3, WAV, M4A, FLAC
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8f9fa" 
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: { 
    fontSize: 28, 
    fontWeight: "700", 
    marginBottom: 8,
    color: "#1a1a1a"
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: "#e1e5e9",
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#333",
  },
  fileButton: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e1e5e9",
    borderStyle: "dashed",
  },
  fileButtonSelected: {
    borderColor: "#007AFF",
    borderStyle: "solid",
    backgroundColor: "#f0f8ff",
  },
  fileButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  fileButtonText: { 
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  fileButtonTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
  fileDetails: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  addButton: {
    backgroundColor: "#007AFF", 
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonDisabled: {
    backgroundColor: "#ccc",
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonLoading: {
    backgroundColor: "#5a9fd4",
  },
  addButtonText: { 
    color: "#fff", 
    fontWeight: "600",
    fontSize: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#e8f4f8",
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});