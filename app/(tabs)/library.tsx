import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Music, Search, Trash2 } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initialSongs as predefinedSongs } from '../../data/songdata';

export default function LibraryScreen() {
  const router = useRouter();

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load songs from AsyncStorage and merge with predefined songs
  const loadSongs = async () => {
    try {
      const storedSongs = await AsyncStorage.getItem('songs');
      const userSongs = storedSongs ? JSON.parse(storedSongs) : [];
      
      // Format predefined songs for display (without filename and pitches)
      const formattedPredefinedSongs = predefinedSongs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        isPredefined: true,
      }));

      // Format user songs
      const formattedUserSongs = userSongs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        isPredefined: false,
        dateAdded: song.dateAdded,
        hasAudioFile: !!song.filename,
      }));

      // Combine and sort (user songs first, then predefined)
      const allSongs = [...formattedUserSongs, ...formattedPredefinedSongs];
      setSongs(allSongs);
    } catch (error) {
      console.error('Error loading songs:', error);
      Alert.alert('Error', 'Failed to load songs from storage');
    } finally {
      setLoading(false);
    }
  };

  // Load songs when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadSongs();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSongs();
    setRefreshing(false);
  };

  const handleDeleteSong = async (songId) => {
    try {
      const storedSongs = await AsyncStorage.getItem('songs');
      const userSongs = storedSongs ? JSON.parse(storedSongs) : [];
      
      const updatedSongs = userSongs.filter(song => song.id !== songId);
      await AsyncStorage.setItem('songs', JSON.stringify(updatedSongs));
      
      // Reload the songs list
      await loadSongs();
      
      Alert.alert('Success', 'Song deleted from library');
    } catch (error) {
      console.error('Error deleting song:', error);
      Alert.alert('Error', 'Failed to delete song');
    }
  };

  const confirmDeleteSong = (song) => {
    Alert.alert(
      'Delete Song',
      `Are you sure you want to delete "${song.title}" by ${song.artist}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => handleDeleteSong(song.id)
        }
      ]
    );
  };

  const handleSongPress = (songId) => {
    router.push({
      pathname: '/pitch-tracker',
      params: { songId: songId }
    });
  };

  const handleAddSong = () => {
    router.push('/addsong');
  };

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderSongItem = ({ item }) => (
    <View style={styles.songItemContainer}>
      <TouchableOpacity 
        style={styles.songItem} 
        onPress={() => handleSongPress(item.id)}
      >
        <View style={styles.songIcon}>
          <Music size={20} color="#666" />
        </View>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle}>{item.title}</Text>
          <Text style={styles.songArtist}>{item.artist}</Text>
        </View>
        <View style={styles.songMeta}>
          <Text style={styles.songDuration}>{item.duration}</Text>
          {!item.isPredefined && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => confirmDeleteSong(item)}
            >
              <Trash2 size={16} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

  const userSongsCount = songs.filter(song => !song.isPredefined).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading your library...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Song Library</Text>
            <Text style={styles.headerSubtitle}>
              {userSongsCount} your songs • {songs.length} total
            </Text>
          </View>
          <TouchableOpacity onPress={handleAddSong} style={styles.addButton}>
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
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No songs found' : 'No songs in library'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Try adjusting your search terms' : 'Add your first song to get started with pitch tracking'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.primaryButton} onPress={handleAddSong}>
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
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  addButton: {
    padding: 8,
    backgroundColor: '#e5e5e5',
    borderRadius: 12,
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
  songItemContainer: {
    marginBottom: 2,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  songIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
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
    color: '#1a1a1a',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#666',
  },
  songMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  songDuration: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 4,
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
    color: '#1a1a1a',
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
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});