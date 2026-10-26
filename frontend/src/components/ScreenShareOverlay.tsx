'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ScreenShareOverlayProps {
    stream: MediaStream | null;
    active: boolean;
}

/**
 * Fullscreen viewer overlay for an incoming admin screen share.
 * Click to unmute if the browser blocked autoplay audio.
 */
export function ScreenShareOverlay({ stream, active }: ScreenShareOverlayProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [needsUnmute, setNeedsUnmute] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !stream || !active) {
            return;
        }

        video.srcObject = stream;
        video.muted = false;
        setNeedsUnmute(false);

        const play = async () => {
            try {
                await video.play();
            } catch {
                // Autoplay with audio often blocked; try muted then prompt unmute.
                try {
                    video.muted = true;
                    await video.play();
                    setNeedsUnmute(true);
                } catch (error) {
                    console.warn('Screen share video play failed:', error);
                }
            }
        };

        void play();

        return () => {
            video.srcObject = null;
        };
    }, [stream, active]);

    if (!active) {
        return null;
    }

    const handleUnmute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = false;
        void video.play();
        setNeedsUnmute(false);
    };

    return (
        <div
            className="absolute inset-0 z-[10000] flex items-center justify-center bg-black"
            onClick={needsUnmute ? handleUnmute : undefined}
            role={needsUnmute ? 'button' : undefined}
        >
            {stream ? (
                <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    autoPlay
                    playsInline
                />
            ) : (
                <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                    <p className="text-sm text-muted-foreground">Connecting to screen share…</p>
                </div>
            )}
            {needsUnmute && (
                <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded bg-black/70 px-4 py-2 text-sm text-white">
                    Click to unmute shared audio
                </div>
            )}
        </div>
    );
}
