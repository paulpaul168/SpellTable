import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Music, Volume2, VolumeX, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { audioTracks, soundEffects, AudioTrack } from '@/config/audio';

interface SoundboardProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Soundboard: React.FC<SoundboardProps> = ({ isOpen, onClose }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(50);
    const [backgroundVolume, setBackgroundVolume] = useState(50);
    const [effectsVolume, setEffectsVolume] = useState(50);
    const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
    const [playlist, setPlaylist] = useState<AudioTrack[]>(audioTracks);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [soundEffectsList, setSoundEffectsList] = useState<AudioTrack[]>(soundEffects);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const activeEffects = useRef<Set<{ audio: HTMLAudioElement, context: AudioContext, gain: GainNode }>>(new Set());

    useEffect(() => {
        // Initialize audio context and elements
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.connect(audioContextRef.current.destination);
        }

        if (!audioRef.current) {
            audioRef.current = new Audio();
            const source = audioContextRef.current.createMediaElementSource(audioRef.current);
            source.connect(gainNodeRef.current!);
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
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
        if (audioRef.current && audioContextRef.current && gainNodeRef.current) {
            // Fade out current track if playing
            if (isPlaying) {
                fadeOut(gainNodeRef.current);
                setTimeout(() => {
                    audioRef.current!.pause();
                    audioRef.current!.currentTime = 0;
                    // Reset the audio element to ensure metadata is reloaded
                    audioRef.current!.load();
                    audioRef.current!.src = track.url;
                    audioRef.current!.loop = track.loop || false;

                    // Load metadata to get duration
                    audioRef.current!.onloadedmetadata = () => {
                        if (audioRef.current) {
                            const updatedTrack = { ...track, duration: audioRef.current.duration };
                            setCurrentTrack(updatedTrack);
                            setPlaylist(prev =>
                                prev.map(t => t.id === track.id ? updatedTrack : t)
                            );

                            // Set random start position if enabled
                            if (track.randomize && audioRef.current.duration) {
                                const randomStart = Math.random() * audioRef.current.duration;
                                audioRef.current.currentTime = randomStart;
                            }
                        }
                    };

                    audioRef.current!.play()
                        .then(() => {
                            fadeIn(gainNodeRef.current!);
                            setIsPlaying(true);
                            setCurrentTrack(track);
                        })
                        .catch(error => {
                            console.error('Error playing track:', error);
                        });
                }, 3000); // Wait for fade out to complete
            } else {
                // If not playing, just start the new track
                audioRef.current.load();
                audioRef.current.src = track.url;
                audioRef.current.loop = track.loop || false;

                audioRef.current.onloadedmetadata = () => {
                    if (audioRef.current) {
                        const updatedTrack = { ...track, duration: audioRef.current.duration };
                        setCurrentTrack(updatedTrack);
                        setPlaylist(prev =>
                            prev.map(t => t.id === track.id ? updatedTrack : t)
                        );

                        // Set random start position if enabled
                        if (track.randomize && audioRef.current.duration) {
                            const randomStart = Math.random() * audioRef.current.duration;
                            audioRef.current.currentTime = randomStart;
                        }
                    }
                };

                audioRef.current.play()
                    .then(() => {
                        fadeIn(gainNodeRef.current!);
                        setIsPlaying(true);
                        setCurrentTrack(track);
                    })
                    .catch(error => {
                        console.error('Error playing track:', error);
                    });
            }
        }
    };

    const togglePlay = () => {
        if (audioRef.current && gainNodeRef.current) {
            if (isPlaying) {
                fadeOut(gainNodeRef.current);
                setTimeout(() => {
                    audioRef.current!.pause();
                }, 500);
            } else {
                audioRef.current.play()
                    .then(() => {
                        fadeIn(gainNodeRef.current!);
                    })
                    .catch(error => {
                        console.error('Error playing track:', error);
                    });
            }
            setIsPlaying(!isPlaying);
        }
    };

    const playNext = () => {
        const nextIndex = (currentIndex + 1) % playlist.length;
        setCurrentIndex(nextIndex);
        playTrack(playlist[nextIndex]);
    };

    const playPrevious = () => {
        const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        setCurrentIndex(prevIndex);
        playTrack(playlist[prevIndex]);
    };

    const playSoundEffect = (effect: AudioTrack) => {
        const audio = new Audio();
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = context.createMediaElementSource(audio);
        const gain = context.createGain();

        source.connect(gain);
        gain.connect(context.destination);

        audio.src = effect.url;
        audio.loop = effect.loop || false;

        // Load metadata to get duration
        audio.onloadedmetadata = () => {
            const updatedEffect = { ...effect, duration: audio.duration };
            setSoundEffectsList(prev =>
                prev.map(e => e.id === effect.id ? updatedEffect : e)
            );

            // Set random start position if enabled
            if (effect.randomize && audio.duration) {
                const randomStart = Math.random() * audio.duration;
                audio.currentTime = randomStart;
            }
        };

        // Only add to active effects and play after metadata is loaded
        audio.oncanplay = () => {
            const effectObj = { audio, context, gain };
            activeEffects.current.add(effectObj);

            // Fade in the effect
            fadeIn(gain);

            audio.play()
                .catch(error => {
                    console.error('Error playing sound effect:', error);
                    activeEffects.current.delete(effectObj);
                });
        };

        if (!effect.loop) {
            audio.onended = () => {
                // Fade out before removing
                fadeOut(gain);
                setTimeout(() => {
                    const effectObj = Array.from(activeEffects.current).find(
                        e => e.audio === audio
                    );
                    if (effectObj) {
                        activeEffects.current.delete(effectObj);
                        context.close();
                    }
                }, 3000); // Match the fadeout duration
            };
        }
    };

    const stopAllEffects = () => {
        // Fade out and stop background music
        if (audioRef.current && gainNodeRef.current) {
            fadeOut(gainNodeRef.current);
            setTimeout(() => {
                audioRef.current!.pause();
                audioRef.current!.currentTime = 0;
                setIsPlaying(false);
            }, 500);
        }

        // Fade out and stop all sound effects
        activeEffects.current.forEach(({ audio, context, gain }) => {
            fadeOut(gain);
            setTimeout(() => {
                audio.pause();
                audio.currentTime = 0;
                context.close();
            }, 500);
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

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-300">Soundboard</span>
                    </div>
                    <div className="flex items-center gap-2">
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
                            Now Playing: {currentTrack.name} {currentTrack.duration && `(${formatDuration(currentTrack.duration)})`}
                        </div>
                    )}

                    {/* Playback Controls */}
                    <div className="flex items-center justify-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={playPrevious}
                        >
                            <SkipBack className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={togglePlay}
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
                        >
                            <SkipForward className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Volume Controls */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setIsMuted(!isMuted)}
                            >
                                {isMuted ? (
                                    <VolumeX className="h-4 w-4" />
                                ) : (
                                    <Volume2 className="h-4 w-4" />
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
                            <Music className="h-4 w-4 text-zinc-400" />
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
                            <Volume2 className="h-4 w-4 text-zinc-400" />
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

                    {/* Music Tracks */}
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-400">Background Music</div>
                        <div className="grid grid-cols-2 gap-2">
                            {audioTracks.map((track) => (
                                <Button
                                    key={track.id}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => playTrack(track)}
                                >
                                    {track.name} {track.duration && `(${formatDuration(track.duration)})`}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Sound Effects */}
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-400">Sound Effects</div>
                        <div className="grid grid-cols-2 gap-2">
                            {soundEffectsList.map((effect) => (
                                <Button
                                    key={effect.id}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => playSoundEffect(effect)}
                                >
                                    {effect.name} {effect.duration && `(${formatDuration(effect.duration)})`}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}; 