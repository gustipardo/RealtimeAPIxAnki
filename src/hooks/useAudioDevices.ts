import { useState, useEffect } from 'react';

/**
 * Hook to check and monitor audio input devices (Microphone).
 * 
 * Educational Note:
 * Browsers require explicit permission to access the microphone.
 * This hook enumerates connected devices to see if at least one 'audioinput' exists.
 * It does NOT ask for permission (that happens at stream request time), 
 * but it tells us if hardware is available.
 */
export function useAudioDevices() {
    const [hasMicrophone, setHasMicrophone] = useState<boolean>(false);

    useEffect(() => {
        const checkDevices = async () => {
            try {
                // navigator.mediaDevices is the standard Web API for media hardware
                const devs = await navigator.mediaDevices.enumerateDevices();
                // Filter for microphones
                const hasMic = devs.some(d => d.kind === 'audioinput');
                setHasMicrophone(hasMic);
            } catch (e) {
                console.error("Error enumerating devices:", e);
                setHasMicrophone(false);
            }
        };

        checkDevices();

        // Optional: Listen for device changes (plugging/unplugging mic)
        navigator.mediaDevices.addEventListener('devicechange', checkDevices);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', checkDevices);
        };
    }, []);

    return { hasMicrophone };
}
