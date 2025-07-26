import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Music, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { initialSongs as predefinedSongs } from '../../data/songdata';

export default function LibraryScreen() {
  const router = useRouter();

  // Initialize songs state with predefinedSongs, only including relevant properties
  const [songs, setSongs] = useState(() => {
    // Filter predefinedSongs to only include properties relevant for display in the library.
    // 'filename' and 'pitches' are not needed here.
    const formattedPredefinedSongs = predefinedSongs.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      duration: song.duration,
    }));
    return formattedPredefinedSongs;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSong, setNewSong] = useState({ title: '', artist: '', duration: '' });

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddSong = () => {
    if (newSong.title.trim() && newSong.artist.trim()) {
      const song = {
        id: Date.now().toString(), // Use Date.now() for unique ID for newly added songs
        ...newSong,
      };
      setSongs([...songs, song]);
      setNewSong({ title: '', artist: '', duration: '' });
      setShowAddForm(false);
    }
  };

  const handleSongPress = (songId) => {
    router.push({
      pathname: '/pitch-tracker',
      params: { songId: songId }
    });
  };

  const renderSongItem = ({ item }) => (
    <TouchableOpacity style={styles.songItem} onPress={() => handleSongPress(item.id)}>
      <View style={styles.songIcon}>
        <Music size={20} color="#666" />
      </View>
      <View style={styles.songInfo}>
        <Text style={styles.songTitle}>{item.title}</Text>
        <Text style={styles.songArtist}>{item.artist}</Text>
      </View>
      <View style={styles.songMeta}>
        <Text style={styles.songDuration}>{item.duration}</Text>
      </View>
    </TouchableOpacity>
  );

  if (showAddForm) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Add New Song</Text>
            <TouchableOpacity onPress={() => setShowAddForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Song Title</Text>
              <TextInput
                style={styles.input}
                value={newSong.title}
                onChangeText={(text) => setNewSong({ ...newSong, title: text })}
                placeholder="Enter song title"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Artist</Text>
              <TextInput
                style={styles.input}
                value={newSong.artist}
                onChangeText={(text) => setNewSong({ ...newSong, artist: text })}
                placeholder="Enter artist name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Duration (Optional)</Text>
              <TextInput
                style={styles.input}
                value={newSong.duration}
                onChangeText={(text) => setNewSong({ ...newSong, duration: text })}
                placeholder="e.g., 3:45"
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleAddSong}>
              <Text style={styles.primaryButtonText}>Add Song</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Song Library</Text>
          <TouchableOpacity onPress={() => setShowAddForm(true)}>
            <Plus size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search songs..."
            placeholderTextColor="#999"
          />
        </View>

        {filteredSongs.length === 0 ? (
          <View style={styles.emptyState}>
            <Music size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>No songs found</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Try adjusting your search' : 'Add your first song to get started'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.primaryButton} onPress={() => setShowAddForm(true)}>
                <Plus size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Add Song</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredSongs}
            renderItem={renderSongItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
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
    paddingTop: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  listContainer: {
    paddingBottom: 100,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  songIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#666',
  },
  songMeta: {
    alignItems: 'flex-end',
  },
  songDuration: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  primaryButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});