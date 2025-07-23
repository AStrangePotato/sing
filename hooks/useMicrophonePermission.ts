import { useEffect, useState } from 'react';
import { Audio } from 'expo-av';

export function useMicrophonePermission() {
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    const requestPermission = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        setPermissionGranted(status === 'granted');
      } catch (error) {
        console.error('Error requesting microphone permission:', error);
        setPermissionGranted(false);
      }
    };

    requestPermission();
  }, []);

  return permissionGranted;
}