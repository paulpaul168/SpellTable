export interface AudioTrack {
    id: string;
    name: string;
    type: 'music' | 'effect';
    url: string;
    duration?: number;  // Will be set when audio loads
    loop?: boolean;
    randomize?: boolean; // Whether to start playback from a random position
    path?: string;      // Optional path for organization
    audioElement?: HTMLAudioElement & { mediaConnected?: boolean }; // Reference to the audio element for streaming with connection status
    isLoading?: boolean;
}

// These arrays will be populated dynamically from the backend API
export const audioTracks: AudioTrack[] = [];
export const soundEffects: AudioTrack[] = [];

// Track the currently active background music track globally
let activeBackgroundTrack: AudioTrack | null = null;

// Add a request limit
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 3;

/**
 * Creates and configures an HTMLAudioElement for streaming audio
 * @param track The audio track to create a streaming element for
 * @returns The configured audio element
 */
export const createStreamingAudioElement = (track: AudioTrack): HTMLAudioElement => {
    // Create audio element if it doesn't exist
    if (!track.audioElement) {
        const audio = new Audio();

        // Configure audio element with CORS attributes
        audio.crossOrigin = "anonymous";
        audio.preload = "metadata";  // Start with metadata, then switch to auto when actually playing

        // Set proper error handlers
        audio.onerror = (e) => {
            console.error(`Audio error for ${track.name}:`, e);
            track.isLoading = false;
            if (activeRequests > 0) activeRequests--;
        };

        // Configure audio element
        audio.src = track.url;
        audio.loop = !!track.loop;

        // Store the element in the track
        track.audioElement = audio as HTMLAudioElement & { mediaConnected?: boolean };
        track.audioElement.mediaConnected = false;

        // Event listener to set duration when metadata loads
        audio.addEventListener('loadedmetadata', () => {
            track.duration = audio.duration;
        });

        // Clear loading flag when audio ends
        audio.addEventListener('ended', () => {
            if (!track.loop) {
                track.isLoading = false;
                if (activeBackgroundTrack === track) {
                    activeBackgroundTrack = null;
                }
            }
        });
    }

    return track.audioElement;
};

/**
 * Plays a streaming audio track
 * @param track The audio track to play
 * @param startPosition Optional position (in seconds) to start playback from
 * @returns Promise that resolves when playback starts
 */
export const playStreamingAudio = async (track: AudioTrack, startPosition?: number): Promise<void> => {
    try {
        // Check if already loading or if we have too many requests
        if (track.isLoading) {
            console.log(`Already loading ${track.name}, skipping request`);
            return;
        }

        if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
            console.log(`Too many concurrent requests (${activeRequests}), skipping ${track.name}`);
            return;
        }

        // Mark as loading and increment request counter
        track.isLoading = true;
        activeRequests++;

        // If this is a music track, ensure only one plays at a time
        if (track.type === 'music') {
            // Stop any currently playing music track
            if (activeBackgroundTrack && activeBackgroundTrack.id !== track.id) {
                stopStreamingAudio(activeBackgroundTrack);
            }
            // Set this as the active track
            activeBackgroundTrack = track;
        }

        const audio = createStreamingAudioElement(track);

        // Now set to auto when we actually want to play
        audio.preload = "auto";

        // Set proper event listeners before loading
        const playPromise = new Promise<void>((resolve, reject) => {
            // Add timeout to prevent indefinite loading
            const timeoutId = setTimeout(() => {
                console.warn(`Timeout loading audio: ${track.name}`);
                audio.removeEventListener('error', errorHandler as EventListener);
                audio.removeEventListener('canplaythrough', loadHandler as EventListener);
                track.isLoading = false;
                activeRequests--;
                reject(new Error(`Timeout loading audio: ${track.name}`));
            }, 10000); // 10 second timeout

            const errorHandler = (e: ErrorEvent) => {
                clearTimeout(timeoutId);
                audio.removeEventListener('error', errorHandler as EventListener);
                audio.removeEventListener('canplaythrough', loadHandler as EventListener);
                track.isLoading = false;
                activeRequests--;
                reject(new Error(`Failed to play ${track.name}: ${e.message}`));
            };

            const loadHandler = () => {
                clearTimeout(timeoutId);
                audio.removeEventListener('error', errorHandler as EventListener);
                audio.removeEventListener('canplaythrough', loadHandler as EventListener);

                // If the audio has ended, reset it
                if (audio.ended) {
                    try {
                        audio.currentTime = 0;
                    } catch (e) {
                        console.warn('Could not reset currentTime:', e);
                    }
                }

                audio.play()
                    .then(() => {
                        activeRequests--;
                        resolve();
                    })
                    .catch(err => {
                        track.isLoading = false;
                        activeRequests--;
                        reject(err);
                    });
            };

            audio.addEventListener('error', errorHandler as EventListener);
            audio.addEventListener('canplaythrough', loadHandler as EventListener);
        });

        // Start loading the audio
        try {
            audio.load();
        } catch (e) {
            console.warn('Error loading audio:', e);
            track.isLoading = false;
            activeRequests--;
            throw e;
        }

        // Set random position if requested and possible
        if (track.randomize && track.duration && !startPosition) {
            const randomPosition = Math.random() * track.duration;
            // Ensure position is valid
            if (Number.isFinite(randomPosition) && randomPosition >= 0) {
                try {
                    audio.currentTime = randomPosition;
                } catch (e) {
                    console.warn('Could not set random position:', e);
                }
            }
        } else if (startPosition !== undefined) {
            // Validate startPosition
            if (Number.isFinite(startPosition) && startPosition >= 0) {
                const maxDuration = track.duration || Infinity;
                try {
                    audio.currentTime = Math.min(startPosition, maxDuration);
                } catch (e) {
                    console.warn('Could not set start position:', e);
                }
            }
        }

        // Wait for playback to start
        await playPromise;
    } catch (error) {
        console.error('Error playing audio:', error);
        // Ensure flags are reset
        track.isLoading = false;
        if (activeRequests > 0) activeRequests--;
        throw error;
    }
};

/**
 * Stops playing a streaming audio track
 * @param track The track to stop
 */
export const stopStreamingAudio = (track: AudioTrack): void => {
    if (track.audioElement) {
        try {
            track.audioElement.pause();

            // Safely reset currentTime
            try {
                track.audioElement.currentTime = 0;
            } catch (e) {
                console.warn('Could not reset currentTime:', e);
            }

            // Reset loading flag
            track.isLoading = false;

            // If this was the active background track, clear it
            if (activeBackgroundTrack && activeBackgroundTrack.id === track.id) {
                activeBackgroundTrack = null;
            }
        } catch (error) {
            console.error('Error stopping audio:', error);
        }
    }
};

/**
 * Stop all currently playing audio tracks
 */
export const stopAllAudio = (): void => {
    // Stop the active background track if any
    if (activeBackgroundTrack) {
        stopStreamingAudio(activeBackgroundTrack);
        activeBackgroundTrack = null;
    }

    // Reset request counter
    activeRequests = 0;

    // Stop all tracks in the audio tracks array
    audioTracks.forEach(track => {
        if (track.audioElement) {
            try {
                track.audioElement.pause();
                track.audioElement.currentTime = 0;
                track.isLoading = false;
            } catch (error) {
                console.error(`Error stopping track ${track.name}:`, error);
            }
        }
    });

    // Stop all sound effects
    soundEffects.forEach(effect => {
        if (effect.audioElement) {
            try {
                effect.audioElement.pause();
                effect.audioElement.currentTime = 0;
                effect.isLoading = false;
            } catch (error) {
                console.error(`Error stopping effect ${effect.name}:`, error);
            }
        }
    });
};

// Function to fetch audio files from the backend
export const fetchAudioFiles = async (): Promise<boolean> => {
    try {
        const response = await fetch('http://localhost:8010/audio/list');
        if (!response.ok) {
            console.error('Failed to fetch audio files:', response.statusText);
            return false;
        }

        const data = await response.json();

        // Clear existing arrays
        audioTracks.length = 0;
        soundEffects.length = 0;

        // Process loop files (background music)
        if (data.loop) {
            for (const [folder, files] of Object.entries(data.loop)) {
                if (Array.isArray(files)) {
                    files.forEach((file: AudioTrack) => {
                        // Update URLs to use the correct port
                        if (file.url && file.url.startsWith('/')) {
                            file.url = `http://localhost:8010${file.url}`;
                        }
                        audioTracks.push(file);
                    });
                }
            }
        }

        // Process oneshot files (sound effects)
        if (data.oneshot) {
            for (const [folder, files] of Object.entries(data.oneshot)) {
                if (Array.isArray(files)) {
                    files.forEach((file: AudioTrack) => {
                        // Update URLs to use the correct port
                        if (file.url && file.url.startsWith('/')) {
                            file.url = `http://localhost:8010${file.url}`;
                        }
                        soundEffects.push(file);
                    });
                }
            }
        }

        // If no files were found, add default placeholders
        if (audioTracks.length === 0) {
            audioTracks.push({
                id: 'no-audio',
                name: 'No Audio Files Found',
                type: 'music',
                url: '',
                loop: false,
                randomize: false
            });
        }

        if (soundEffects.length === 0) {
            soundEffects.push({
                id: 'no-effects',
                name: 'No Sound Effects Found',
                type: 'effect',
                url: '',
                loop: false,
                randomize: false
            });
        }

        return true;

    } catch (error) {
        console.error('Error fetching audio files:', error);

        // Add fallback options if the API fails
        if (audioTracks.length === 0) {
            audioTracks.push({
                id: 'api-error',
                name: 'API Error - Check Console',
                type: 'music',
                url: '',
                loop: false,
                randomize: false
            });
        }

        if (soundEffects.length === 0) {
            soundEffects.push({
                id: 'api-error',
                name: 'API Error - Check Console',
                type: 'effect',
                url: '',
                loop: false,
                randomize: false
            });
        }

        return false;
    }
}; 