import { useState, useCallback, useEffect, useRef } from 'react';
import { websocketService } from '@/services/websocket';

interface UseNightModeOptions {
    /** When false, only applies remote updates (viewer). Default true (admin). */
    broadcast?: boolean;
}

export function useNightMode(options: UseNightModeOptions = {}) {
    const shouldBroadcast = options.broadcast !== false;
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [brightness, setBrightness] = useState(100);
    const brightnessRef = useRef(brightness);
    brightnessRef.current = brightness;

    const applyNightMode = useCallback(
        (enabled: boolean, nextBrightness: number, broadcast = shouldBroadcast) => {
            setIsDarkMode(enabled);
            setBrightness(nextBrightness);
            if (broadcast) {
                websocketService.send({
                    type: 'scene_event',
                    eventType: 'night_mode',
                    enabled,
                    brightness: nextBrightness,
                });
            }
        },
        [shouldBroadcast]
    );

    useEffect(() => {
        const handleRemoteEvents = (data: {
            type?: string;
            eventType?: string;
            enabled?: boolean;
            brightness?: number;
        }) => {
            if (data.type !== 'scene_event' || data.eventType !== 'night_mode') {
                return;
            }
            const enabled = Boolean(data.enabled);
            const nextBrightness =
                typeof data.brightness === 'number'
                    ? data.brightness
                    : brightnessRef.current;
            applyNightMode(enabled, nextBrightness, false);
        };

        const unsubscribe = websocketService.addListener(handleRemoteEvents);
        return () => unsubscribe();
    }, [applyNightMode]);

    return { isDarkMode, brightness, applyNightMode };
}
