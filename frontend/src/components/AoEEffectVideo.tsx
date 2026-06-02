'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AoEShape } from '@/types/map';
import type { AoEEffectFit, AoEEffectMeta, AoEEffectTheme } from '@/types/aoeEffect';
import { getAoEEffectMediaUrl, loadAoEEffectMeta } from '@/lib/aoeEffects';

interface AoEEffectVideoProps {
    effectId: string;
    theme: AoEEffectTheme;
    shape: AoEShape;
    width: number;
    height: number;
    opacity: number;
    onMetaLoaded?: (loaded: boolean) => void;
}

function coneClipPath(): string {
    return 'polygon(50% 0%, 0% 100%, 100% 100%)';
}

function resolveFit(meta: AoEEffectMeta | null, shape: AoEShape): AoEEffectFit {
    if (meta?.fit) {
        if (meta.fit === 'orbit') {
            return 'ball';
        }
        return meta.fit;
    }
    if (shape === 'line') {
        return 'line-fill';
    }
    if (shape === 'cone') {
        return 'cone';
    }
    return 'ball';
}

function clipStyle(shape: AoEShape, fit: AoEEffectFit): React.CSSProperties {
    if (fit === 'cone' || shape === 'cone') {
        return { clipPath: coneClipPath(), WebkitClipPath: coneClipPath() };
    }
    if (shape === 'circle' || shape === 'cylinder') {
        return { borderRadius: '50%' };
    }
    return {};
}

export const AoEEffectVideo: React.FC<AoEEffectVideoProps> = ({
    effectId,
    theme,
    shape,
    width,
    height,
    opacity,
    onMetaLoaded,
}) => {
    const [meta, setMeta] = useState<AoEEffectMeta | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const onMetaLoadedRef = useRef(onMetaLoaded);
    onMetaLoadedRef.current = onMetaLoaded;

    useEffect(() => {
        let cancelled = false;
        onMetaLoadedRef.current?.(false);
        void loadAoEEffectMeta(effectId, theme).then((loaded) => {
            if (!cancelled) {
                setMeta(loaded);
                onMetaLoadedRef.current?.(loaded !== null && Boolean(loaded?.media));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [effectId, theme]);

    const fit = resolveFit(meta, shape);
    const media = meta?.media ?? 'loop.webm';
    const src = meta ? getAoEEffectMediaUrl(theme, effectId, media) : '';
    const blendMode = meta?.blendMode ?? 'screen';
    const zoom = meta?.zoom ?? 1;

    useEffect(() => {
        const root = rootRef.current;
        const video = videoRef.current;
        if (!root || !video || !meta) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.some((e) => e.isIntersecting);
                if (visible) {
                    void video.play().catch(() => undefined);
                } else {
                    video.pause();
                }
            },
            { threshold: 0.05 },
        );
        observer.observe(root);
        return () => observer.disconnect();
    }, [meta, src]);

    const containerStyle = useMemo((): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            opacity,
            mixBlendMode: blendMode === 'normal' ? undefined : blendMode,
            ...clipStyle(shape, fit),
        };

        if (fit === 'ball') {
            return base;
        }
        return base;
    }, [shape, fit, opacity, blendMode]);

    const videoStyle = useMemo((): React.CSSProperties => {
        const filter = meta?.filter;
        if (fit === 'line-fill') {
            return {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                filter,
                transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            };
        }
        if (fit === 'cone') {
            return {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: '50% 100%',
                filter,
                transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            };
        }
        return {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            filter,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
        };
    }, [fit, meta?.filter, zoom]);

    if (!meta?.media) {
        return null;
    }

    return (
        <div ref={rootRef} className="pointer-events-none absolute inset-0" style={containerStyle}>
            <video
                ref={videoRef}
                key={src}
                className="h-full w-full"
                style={videoStyle}
                src={src}
                autoPlay
                loop={meta.loop !== false}
                muted
                playsInline
                preload="metadata"
            />
        </div>
    );
};
