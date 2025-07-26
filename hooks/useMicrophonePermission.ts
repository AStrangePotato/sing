import { useEffect, useState } from 'react';
import { Audio } from 'expo-av';

export function useMicrophonePermission() {
  const [permissionGranted, setPermissionGranted] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Audio.getPermissionsAsync();
        if (status === 'granted') {
          setPermissionGranted(true);
        } else {
          // This will prompt the user only if permission is undetermined.
          // If denied, it will not prompt and return 'denied'.
          const { status: newStatus } = await Audio.requestPermissionsAsync();
          setPermissionGranted(newStatus === 'granted');
        }
      } catch (error) {
        console.error('Error requesting microphone permission:', error);
        setPermissionGranted(false);
      }
    })();
  }, []);

  return permissionGranted;
}
