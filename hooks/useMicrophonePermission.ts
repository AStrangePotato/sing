import { useEffect, useState } from 'react';
import { Audio } from 'expo-av';

export function useMicrophonePermission() {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  useEffect(() => {
    const requestPermission = async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setPermissionGranted(status === 'granted');
    };

    requestPermission();
  }, []);

  return permissionGranted;
}
