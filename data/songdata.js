export const initialSongs = [
    {
      id: 'uniqueSongId1',
      title: 'Song Title 1',
      artist: 'Artist Name 1',
      duration: '03:15', // Format as MM:SS
      filename: require('../assets/audio/vocals.mp3'), // Adjust path as needed
      pitches: [
        { time: 0.5, pitch: 60 }, // Example: C4 at 0.5 seconds
        { time: 1.2, pitch: 62 }, // Example: D4 at 1.2 seconds
        { time: 2.0, pitch: 64 }, // Example: E4 at 2.0 seconds
      ],
    },
]