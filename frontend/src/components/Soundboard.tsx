import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Music, Volume2, VolumeX, Play, Pause, SkipBack, SkipForward, RefreshCw, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import {
    audioTracks,
    soundEffects,
    AudioTrack,
    fetchAudioFiles,
    createStreamingAudioElement,
    playStreamingAudio,
    stopStreamingAudio,
    stopAllAudio
} from '@/config/audio';

interface SoundboardProps {
    isOpen: boolean;
    onClose: () => void;
}

// Interface for folder structure
interface AudioFolder {
    name: string;
    tracks: AudioTrack[];
    subfolders: { [key: string]: AudioFolder };
}

export const Soundboard: React.FC<SoundboardProps> = ({ isOpen, onClose }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(50);
    const [backgroundVolume, setBackgroundVolume] = useState(50);
    const [effectsVolume, setEffectsVolume] = useState(50);
    const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
    const [playlist, setPlaylist] = useState<AudioTrack[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [soundEffectsList, setSoundEffectsList] = useState<AudioTrack[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
    const [volumeControlsVisible, setVolumeControlsVisible] = useState(false);
    const [folderStructure, setFolderStructure] = useState<{
        music: AudioFolder;
        effects: AudioFolder;
    }>({
        music: { name: 'Music', tracks: [], subfolders: {} },
        effects: { name: 'Effects', tracks: [], subfolders: {} }
    });

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const activeEffects = useRef<Set<{ audio: HTMLAudioElement, context: AudioContext, gain: GainNode }>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const seekBarRef = useRef<HTMLDivElement>(null);

    // Set up interval to update current time
    useEffect(() => {
        let timeUpdateInterval: NodeJS.Timeout | null = null;

        if (isPlaying && currentTrack && currentTrack.audioElement) {
            // Update time immediately
            setCurrentTime(currentTrack.audioElement.currentTime || 0);

            // Then set up interval for regular updates - use a longer interval to reduce updates
            timeUpdateInterval = setInterval(() => {
                if (currentTrack.audioElement) {
                    try {
                        const time = currentTrack.audioElement.currentTime || 0;
                        const duration = currentTrack.audioElement.duration || 0;

                        // Update current time
                        setCurrentTime(time);

                        // Update track duration if it has changed
                        if (duration > 0 && duration !== currentTrack.duration) {
                            currentTrack.duration = duration;
                        }
                    } catch (e) {
                        // Ignore errors during time updates
                        console.warn('Error updating time:', e);
                    }
                }
            }, 500); // Update 2 times per second instead of 4 to reduce processing
        }

        return () => {
            if (timeUpdateInterval) {
                clearInterval(timeUpdateInterval);
            }
        };
    }, [isPlaying, currentTrack]);

    // Install global error handler
    useEffect(() => {
        // Create a more robust error handler
        const originalConsoleError = console.error;
        const ignoredErrors = [
            'postMessage on disconnected port',
            'Failed to get subsystem status for purpose',
            'Promised response from onMessage listener went out of scope'
        ];

        console.error = (...args: any[]) => {
            // Convert args to string for easier filtering
            const errorMsg = args.join(' ');

            // Skip reporting disconnected port errors
            if (ignoredErrors.some(err => errorMsg.includes(err))) {
                return; // Ignore these errors
            }

            // Pass through all other errors
            originalConsoleError.apply(console, args);
        };

        return () => {
            // Restore original console.error
            console.error = originalConsoleError;
        };
    }, []);

    // Initial data fetch when component mounts
    useEffect(() => {
        loadAudioFiles();

        // Set up global error handlers to catch port disconnection errors
        const originalConsoleError = console.error;
        console.error = (...args) => {
            // Ignore specific errors related to port disconnection
            const errorText = args.join(' ');
            if (
                errorText.includes('postMessage on disconnected port') ||
                errorText.includes('Failed to get subsystem status for purpose')
            ) {
                // Ignore these errors
                return;
            }

            // Pass all other errors to the original console.error
            originalConsoleError.apply(console, args);
        };

        // Restore original on cleanup
        return () => {
            console.error = originalConsoleError;
            // Stop all playing audio before unmounting
            stopAllAudio();
        };
    }, []);

    // Build folder structure from tracks
    const buildFolderStructure = useCallback(() => {
        const musicRoot: AudioFolder = { name: 'Music', tracks: [], subfolders: {} };
        const effectsRoot: AudioFolder = { name: 'Effects', tracks: [], subfolders: {} };

        // Process music tracks
        audioTracks.forEach(track => {
            if (!track.path) {
                musicRoot.tracks.push(track);
                return;
            }

            const pathParts = track.path.split('/').filter(Boolean);
            let currentFolder = musicRoot;

            // Navigate through the path and create subfolders as needed
            for (let i = 0; i < pathParts.length - 1; i++) {
                const folderName = pathParts[i];
                if (!currentFolder.subfolders[folderName]) {
                    currentFolder.subfolders[folderName] = {
                        name: folderName,
                        tracks: [],
                        subfolders: {}
                    };
                }
                currentFolder = currentFolder.subfolders[folderName];
            }

            // Add track to the final folder
            currentFolder.tracks.push(track);
        });

        // Process sound effects
        soundEffects.forEach(effect => {
            if (!effect.path) {
                effectsRoot.tracks.push(effect);
                return;
            }

            const pathParts = effect.path.split('/').filter(Boolean);
            let currentFolder = effectsRoot;

            // Navigate through the path and create subfolders as needed
            for (let i = 0; i < pathParts.length - 1; i++) {
                const folderName = pathParts[i];
                if (!currentFolder.subfolders[folderName]) {
                    currentFolder.subfolders[folderName] = {
                        name: folderName,
                        tracks: [],
                        subfolders: {}
                    };
                }
                currentFolder = currentFolder.subfolders[folderName];
            }

            // Add effect to the final folder
            currentFolder.tracks.push(effect);
        });

        setFolderStructure({
            music: musicRoot,
            effects: effectsRoot
        });
    }, []);

    // Function to load audio files from backend
    const loadAudioFiles = async () => {
        setLoading(true);
        try {
            const success = await fetchAudioFiles();

            if (success) {
                setPlaylist([...audioTracks]);
                setSoundEffectsList([...soundEffects]);
                if (audioTracks.length > 0 && !currentTrack) {
                    setCurrentTrack(audioTracks[0]);
                }

                // Build folder structure
                buildFolderStructure();
            }
        } catch (error) {
            console.error("Error loading audio files:", error);
        } finally {
            setLoading(false);
        }
    };

    // Toggle folder expansion
    const toggleFolder = (folderPath: string) => {
        setExpandedFolders(prev => ({
            ...prev,
            [folderPath]: !prev[folderPath]
        }));
    };

    // Function to seek to a specific position in the current track
    const seekTo = (position: number) => {
        if (!currentTrack?.audioElement) return;

        try {
            // Ensure position is valid
            if (Number.isFinite(position) && position >= 0) {
                const maxDuration = currentTrack.duration || 0;
                const safePosition = Math.min(position, maxDuration);

                // Only set if we have a valid number
                if (Number.isFinite(safePosition)) {
                    // Update the UI immediately for better responsiveness
                    setCurrentTime(safePosition);

                    // Set the actual audio position
                    currentTrack.audioElement.currentTime = safePosition;

                    // If paused, we might want to temporarily play a bit to load the audio at that position
                    if (!isPlaying && currentTrack.audioElement.paused) {
                        const tempPlay = async () => {
                            try {
                                // Play briefly to ensure the position is loaded
                                await currentTrack.audioElement!.play();
                                // Then immediately pause
                                setTimeout(() => {
                                    if (currentTrack.audioElement && !isPlaying) {
                                        currentTrack.audioElement.pause();
                                    }
                                }, 100);
                            } catch (e) {
                                console.warn('Could not briefly play audio to set position:', e);
                            }
                        };

                        // Try to play/pause to ensure the position is loaded
                        tempPlay().catch(e => console.warn(e));
                    }
                }
            }
        } catch (error) {
            console.error('Error seeking in audio:', error);
        }
    };

    // Recursive component to render folder structure
    const renderFolder = (folder: AudioFolder, path: string, type: 'music' | 'effect') => {
        const folderPath = path ? `${path}/${folder.name}` : folder.name;
        const isExpanded = expandedFolders[folderPath] !== false; // Default to expanded

        return (
            <div key={folderPath} className="ml-1">
                {/* Folder name with expand/collapse toggle */}
                {folder.name !== 'Music' && folder.name !== 'Effects' && (
                    <div
                        className="flex items-center gap-1 cursor-pointer text-xs text-zinc-400 hover:text-zinc-300 mt-1"
                        onClick={() => toggleFolder(folderPath)}
                    >
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <Folder className="h-3 w-3 mr-1" />
                        {folder.name}
                    </div>
                )}

                {/* Folder contents (if expanded) */}
                {isExpanded && (
                    <div className="ml-4">
                        {/* Tracks in this folder */}
                        <div className="grid grid-cols-1 gap-1">
                            {folder.tracks.map(track => (
                                <Button
                                    key={track.id}
                                    variant="outline"
                                    size="sm"
                                    className={cn("h-8 text-xs justify-start overflow-hidden",
                                        currentTrack?.id === track.id && isPlaying && "bg-zinc-700/50")}
                                    onClick={() => type === 'music' ? playTrack(track) : playSoundEffect(track)}
                                    disabled={!track.url}
                                >
                                    <span className="truncate">
                                        {track.name} {track.duration && `(${formatDuration(track.duration)})`}
                                    </span>
                                </Button>
                            ))}
                        </div>

                        {/* Subfolders */}
                        {Object.values(folder.subfolders).map(subfolder =>
                            renderFolder(subfolder, folderPath, type)
                        )}
                    </div>
                )}
            </div>
        );
    };

    useEffect(() => {
        // Initialize audio context and elements
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.connect(audioContextRef.current.destination);
        }

        // We no longer need to create our own Audio element as it's handled by the streaming functions

        return () => {
            // Clean up tracks and effects when component unmounts
            if (currentTrack) {
                stopStreamingAudio(currentTrack);
            }

            // Clean up any active sound effects
            activeEffects.current.forEach(({ audio, context }) => {
                audio.pause();
                context.close();
            });
            activeEffects.current.clear();
        };
    }, []);

    useEffect(() => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = isMuted ? 0 : (volume / 100) * (backgroundVolume / 100);
        }
        // Update volume for all active sound effects
        activeEffects.current.forEach(({ gain }) => {
            gain.gain.value = isMuted ? 0 : (volume / 100) * (effectsVolume / 100);
        });
    }, [volume, isMuted, backgroundVolume, effectsVolume]);

    const fadeIn = (gainNode: GainNode, duration: number = 2.5) => {
        gainNode.gain.setValueAtTime(0, audioContextRef.current!.currentTime);
        gainNode.gain.linearRampToValueAtTime(
            isMuted ? 0 : (gainNode === gainNodeRef.current ? (volume / 100) * (backgroundVolume / 100) : (volume / 100) * (effectsVolume / 100)),
            audioContextRef.current!.currentTime + duration
        );
    };

    const fadeOut = (gainNode: GainNode, duration: number = 3) => {
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioContextRef.current!.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioContextRef.current!.currentTime + duration);
    };

    const playTrack = (track: AudioTrack) => {
        if (!track.url) {
            console.error('Track has no URL:', track);
            return;
        }

        // First stop current track if playing
        if (currentTrack && isPlaying) {
            if (gainNodeRef.current) {
                // Fade out current track
                fadeOut(gainNodeRef.current);
            }

            setTimeout(() => {
                if (currentTrack) {
                    stopStreamingAudio(currentTrack);
                }

                startNewTrack(track);
            }, 3000); // Wait for fade out
        } else {
            // No current track, just play the new one
            startNewTrack(track);
        }
    };

    // Create a memoized version of the startNewTrack function
    const startNewTrack = useCallback((track: AudioTrack) => {
        try {
            // Create and set up new audio element for streaming
            const audio = createStreamingAudioElement(track);

            if (audioContextRef.current && gainNodeRef.current) {
                // Resume the audio context if it's suspended
                if (audioContextRef.current.state === 'suspended') {
                    audioContextRef.current.resume()
                        .catch(err => console.error('Error resuming audio context:', err));
                }

                // Connect to gain node if not already connected
                if (!track.audioElement?.mediaConnected && audio) {
                    try {
                        const source = audioContextRef.current.createMediaElementSource(audio);
                        source.connect(gainNodeRef.current);

                        // Mark as connected to prevent reconnection attempts
                        if (track.audioElement) {
                            track.audioElement.mediaConnected = true;
                        }
                    } catch (err: any) {
                        // Check if error is about already being connected
                        if (!err.toString().includes('already been connected')) {
                            console.error('Error connecting audio to context:', err);
                        }
                    }
                }

                // Play the track using our streaming function
                playStreamingAudio(track)
                    .then(() => {
                        fadeIn(gainNodeRef.current!);
                        setIsPlaying(true);
                        setCurrentTrack(track);

                        // Find index in playlist and update
                        const index = playlist.findIndex(t => t.id === track.id);
                        if (index >= 0) {
                            setCurrentIndex(index);
                        }
                    })
                    .catch(error => {
                        // Ignore specific errors to prevent console spam
                        if (!error.toString().includes('user agent') &&
                            !error.toString().includes('user aborted')) {
                            console.error('Error playing track:', error);
                        }
                    });
            }
        } catch (error) {
            console.error('Error in startNewTrack:', error);
        }
    }, [playlist, fadeIn, gainNodeRef, audioContextRef, setIsPlaying, setCurrentTrack, setCurrentIndex]);

    const togglePlay = () => {
        if (!currentTrack) return;

        if (gainNodeRef.current) {
            if (isPlaying) {
                fadeOut(gainNodeRef.current);
                setTimeout(() => {
                    if (currentTrack && currentTrack.audioElement) {
                        currentTrack.audioElement.pause();
                    }
                }, 500);
            } else {
                if (currentTrack && currentTrack.audioElement) {
                    currentTrack.audioElement.play()
                        .then(() => {
                            fadeIn(gainNodeRef.current!);
                        })
                        .catch(error => {
                            console.error('Error playing track:', error);
                        });
                }
            }
            setIsPlaying(!isPlaying);
        }
    };

    const playNext = () => {
        if (playlist.length === 0) return;
        const nextIndex = (currentIndex + 1) % playlist.length;
        setCurrentIndex(nextIndex);
        playTrack(playlist[nextIndex]);
    };

    const playPrevious = () => {
        if (playlist.length === 0) return;
        const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        setCurrentIndex(prevIndex);
        playTrack(playlist[prevIndex]);
    };

    const playSoundEffect = (effect: AudioTrack) => {
        if (!effect.url) {
            console.error('Sound effect has no URL:', effect);
            return;
        }

        // Check if already loading
        if (effect.isLoading) {
            console.log(`Already loading effect ${effect.name}, skipping request`);
            return;
        }

        try {
            // Mark as loading
            effect.isLoading = true;

            // Create streaming audio element
            const audio = createStreamingAudioElement(effect);

            // Ensure audio is set to preload everything
            audio.preload = "auto";

            // Create a separate audio context for this effect
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Resume context if needed
            if (context.state === 'suspended') {
                context.resume().catch(err => console.error('Error resuming audio context:', err));
            }

            try {
                const source = context.createMediaElementSource(audio);
                const gain = context.createGain();

                source.connect(gain);
                gain.connect(context.destination);

                // Set the initial gain value
                gain.gain.value = isMuted ? 0 : (volume / 100) * (effectsVolume / 100);

                // Track this effect for volume control and cleanup
                const effectObj = { audio, context, gain };
                activeEffects.current.add(effectObj);

                // Fade in the effect
                fadeIn(gain);

                // Set a timeout to prevent indefinite loading
                const timeoutId = setTimeout(() => {
                    console.warn(`Timeout loading sound effect: ${effect.name}`);
                    effect.isLoading = false;
                    cleanupEffect();
                }, 8000); // 8 second timeout

                const cleanupEffect = () => {
                    clearTimeout(timeoutId);
                    try {
                        gain.disconnect();
                        context.close();
                        activeEffects.current.delete(effectObj);
                        effect.isLoading = false;
                    } catch (err) {
                        console.error('Error cleaning up sound effect:', err);
                    }
                };

                // Use canplaythrough instead of canplay for better buffering
                audio.addEventListener('canplaythrough', () => {
                    audio.play()
                        .then(() => {
                            console.log('Sound effect playing:', effect.name);
                        })
                        .catch(error => {
                            console.error('Error playing sound effect:', error);
                            cleanupEffect();
                        });
                }, { once: true });

                // Load the audio
                audio.load();

                // Remove from active effects when it finishes
                audio.onended = () => {
                    cleanupEffect();
                };

                // Also handle errors
                audio.onerror = () => {
                    console.error(`Error loading sound effect: ${effect.name}`);
                    cleanupEffect();
                };
            } catch (err) {
                console.error('Error setting up audio graph for sound effect:', err);
                effect.isLoading = false;
                context.close();
            }
        } catch (err) {
            console.error('Error creating sound effect:', err);
            effect.isLoading = false;
        }
    };

    const stopAllEffects = () => {
        // Use our global stop function to halt all audio
        stopAllAudio();
        setIsPlaying(false);
        setCurrentTime(0);

        // For UI consistency
        activeEffects.current.forEach(({ audio, context, gain }) => {
            try {
                fadeOut(gain, 1);
                setTimeout(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    context.close();
                }, 1000);
            } catch (err) {
                // Ignore errors during cleanup
            }
        });
        activeEffects.current.clear();
    };

    // Format duration in minutes:seconds
    const formatDuration = (seconds: number | undefined) => {
        if (!seconds) return '';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    // Function to handle seeking with keyboard arrows
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only if we have a current track and we're in the soundboard
            if (!currentTrack || !isOpen) return;

            // Skip by 5 seconds with arrow keys
            const skipAmount = 5;
            if (e.key === 'ArrowRight' && currentTrack.audioElement) {
                const newPosition = Math.min(
                    (currentTrack.audioElement.currentTime || 0) + skipAmount,
                    currentTrack.duration || 0
                );
                seekTo(newPosition);
                e.preventDefault();
            } else if (e.key === 'ArrowLeft' && currentTrack.audioElement) {
                const newPosition = Math.max(
                    (currentTrack.audioElement.currentTime || 0) - skipAmount,
                    0
                );
                seekTo(newPosition);
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentTrack, isOpen]);

    // Handle drag functionality for the seekbar
    useEffect(() => {
        if (!seekBarRef.current) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && currentTrack?.duration && seekBarRef.current) {
                const rect = seekBarRef.current.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                const normalizedPos = Math.max(0, Math.min(1, pos));

                // Just update the visual position during drag
                setCurrentTime(normalizedPos * currentTrack.duration);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (isDragging && currentTrack?.duration && seekBarRef.current) {
                const rect = seekBarRef.current.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                const normalizedPos = Math.max(0, Math.min(1, pos));

                // Actually seek when mouse is released
                seekTo(normalizedPos * currentTrack.duration);
                setIsDragging(false);
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, currentTrack]);

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-zinc-800 w-80">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-300">Soundboard</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={loadAudioFiles}
                            title="Refresh Audio Files"
                        >
                            <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="px-2 h-6 text-xs"
                            onClick={stopAllEffects}
                        >
                            Stop All
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={onClose}
                        >
                            ×
                        </Button>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Current Track Info */}
                    {currentTrack && (
                        <div className="text-xs text-zinc-400 truncate">
                            Now Playing: {currentTrack.name}
                        </div>
                    )}

                    {/* Audio Player Controls with Seek Bar */}
                    <div className="space-y-2">
                        {/* Seek Bar */}
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span>{formatDuration(currentTime)}</span>
                            <div className="relative flex-1 h-2 bg-zinc-700 rounded-lg overflow-hidden cursor-pointer">
                                <div
                                    className="w-full h-full absolute z-10"
                                    onClick={(e) => {
                                        if (currentTrack?.duration && currentTrack.duration > 0) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const pos = (e.clientX - rect.left) / rect.width;
                                            // Ensure pos is between 0 and 1
                                            const normalizedPos = Math.max(0, Math.min(1, pos));
                                            seekTo(normalizedPos * currentTrack.duration);
                                        }
                                    }}
                                />
                                {currentTrack?.duration && (
                                    <div
                                        className="h-full bg-zinc-500 absolute pointer-events-none"
                                        style={{ width: `${(currentTime / currentTrack.duration) * 100}%` }}
                                    />
                                )}
                                <div
                                    className="h-4 w-4 rounded-full bg-white absolute top-1/2 transform -translate-y-1/2 -ml-2 shadow-md pointer-events-none"
                                    style={{
                                        left: currentTrack?.duration ? `${(currentTime / currentTrack.duration) * 100}%` : 0
                                    }}
                                />
                            </div>
                            <span>{formatDuration(currentTrack?.duration)}</span>
                        </div>

                        {/* Playback Controls */}
                        <div className="flex items-center justify-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={playPrevious}
                                disabled={playlist.length === 0}
                            >
                                <SkipBack className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={togglePlay}
                                disabled={!currentTrack || !currentTrack.url}
                            >
                                {isPlaying ? (
                                    <Pause className="h-4 w-4" />
                                ) : (
                                    <Play className="h-4 w-4" />
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={playNext}
                                disabled={playlist.length === 0}
                            >
                                <SkipForward className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="text-center py-2">
                            <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                            <div className="text-xs text-zinc-400 mt-1">Loading audio files...</div>
                        </div>
                    )}

                    {/* Music Tracks (Folder Structure) */}
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-400">Background Music</div>
                        <div className="max-h-40 overflow-y-auto pr-1">
                            {renderFolder(folderStructure.music, '', 'music')}
                        </div>
                    </div>

                    {/* Sound Effects (Folder Structure) */}
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-400">Sound Effects</div>
                        <div className="max-h-40 overflow-y-auto pr-1">
                            {renderFolder(folderStructure.effects, '', 'effect')}
                        </div>
                    </div>

                    {/* Volume Controls Section at the bottom */}
                    <div className="pt-2 border-t border-zinc-800 mt-2">
                        <div
                            className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 px-2 py-1 rounded-md"
                            onClick={() => setVolumeControlsVisible(!volumeControlsVisible)}
                        >
                            {volumeControlsVisible ?
                                <ChevronDown className="h-4 w-4 text-zinc-400" /> :
                                <ChevronRight className="h-4 w-4 text-zinc-400" />
                            }
                            <div className="text-xs font-medium text-zinc-400">Volume Controls</div>
                            {!volumeControlsVisible && (
                                <div className="ml-auto flex items-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMuted(!isMuted);
                                        }}
                                    >
                                        {isMuted ? (
                                            <VolumeX className="h-3 w-3 text-zinc-500" />
                                        ) : (
                                            <Volume2 className="h-3 w-3 text-zinc-500" />
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {volumeControlsVisible && (
                            <div className="space-y-2 mt-2 pl-2 pr-1 py-1 bg-zinc-800/30 rounded-md">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => setIsMuted(!isMuted)}
                                    >
                                        {isMuted ? (
                                            <VolumeX className="h-3 w-3" />
                                        ) : (
                                            <Volume2 className="h-3 w-3" />
                                        )}
                                    </Button>
                                    <div className="flex-1">
                                        <div className="text-xs text-zinc-400 mb-1">Master Volume</div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={volume}
                                            onChange={(e) => setVolume(parseInt(e.target.value))}
                                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Music className="h-3 w-3 text-zinc-400 ml-1" />
                                    <div className="flex-1">
                                        <div className="text-xs text-zinc-400 mb-1">Background Music</div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={backgroundVolume}
                                            onChange={(e) => setBackgroundVolume(parseInt(e.target.value))}
                                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Volume2 className="h-3 w-3 text-zinc-400 ml-1" />
                                    <div className="flex-1">
                                        <div className="text-xs text-zinc-400 mb-1">Sound Effects</div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={effectsVolume}
                                            onChange={(e) => setEffectsVolume(parseInt(e.target.value))}
                                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}; 