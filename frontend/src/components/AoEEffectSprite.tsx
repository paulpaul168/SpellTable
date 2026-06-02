'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AoEShape } from '@/types/map';
import type { AoEEffectMeta } from '@/types/aoeEffect';
import type { AoEEffectTheme } from '@/types/aoeEffect';
import { getAoEEffectSheetUrl, loadAoEEffectMeta } from '@/lib/aoeEffects';

interface AoEEffectSpriteProps {
    effectId: string;
    theme: AoEEffectTheme;
    shape: AoEShape;
    width: number;
    height: number;
    opacity: number;
    tintColor?: string;
    onMetaLoaded?: (loaded: boolean) => void;
}

function coneClipPath(): string {
    return 'polygon(50% 0%, 0% 100%, 100% 100%)';
}

function buildStretchSpriteStyle(
    meta: AoEEffectMeta,
    sheetUrl: string,
    width: number,
    height: number,
    opacity: number,
    durationSec: number,
    steps: number,
    animationDelaySec = 0,
): React.CSSProperties {
    const frameCount = meta.frameCount ?? 1;
    const totalShift = width * (frameCount - 1);
    const blendMode = meta.blendMode ?? 'normal';
    return {
        width: '100%',
        height: '100%',
        backgroundImage: `url(${sheetUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: '0 0',
        backgroundSize: `${width * frameCount}px ${height}px`,
        imageRendering: 'pixelated',
        opacity,
        mixBlendMode: blendMode === 'normal' ? undefined : blendMode,
        filter: meta.filter,
        ['--aoe-shift-x' as string]: `-${totalShift}px`,
        animation: `aoe-effect-sprite ${durationSec}s steps(${steps}) ${meta.loop ? 'infinite' : 'forwards'}`,
        animationDelay: animationDelaySec ? `${animationDelaySec}s` : undefined,
    };
}

function buildOrbitSpiritStyle(
    meta: AoEEffectMeta,
    sheetUrl: string,
    spiritSize: number,
    opacity: number,
    durationSec: number,
    steps: number,
    delaySec: number,
): React.CSSProperties {
    const frameCount = meta.frameCount ?? 1;
    const totalShift = spiritSize * (frameCount - 1);
    const blendMode = meta.blendMode ?? 'normal';
    return {
        width: `${spiritSize}px`,
        height: `${spiritSize}px`,
        backgroundImage: `url(${sheetUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: '0 0',
        backgroundSize: `${spiritSize * frameCount}px ${spiritSize}px`,
        imageRendering: 'pixelated',
        opacity,
        mixBlendMode: blendMode === 'normal' ? undefined : blendMode,
        filter: meta.filter,
        ['--aoe-shift-x' as string]: `-${totalShift}px`,
        animation: `aoe-effect-sprite ${durationSec}s steps(${steps}) ${meta.loop ? 'infinite' : 'forwards'}`,
        animationDelay: `${delaySec}s`,
    };
}

function ballGlow(effectId: string): string {
    if (effectId.includes('lightning') || effectId.includes('nebula')) {
        return 'radial-gradient(circle at 50% 50%, rgba(230,245,255,0.95) 0%, rgba(120,180,255,0.8) 35%, rgba(40,100,220,0.5) 65%, rgba(20,40,120,0.2) 85%, transparent 100%)';
    }
    return 'radial-gradient(circle at 50% 50%, rgba(255,200,80,0.95) 0%, rgba(255,100,20,0.75) 35%, rgba(220,40,0,0.45) 65%, rgba(120,0,0,0.15) 85%, transparent 100%)';
}

function lineGlow(effectId: string): string {
    if (effectId.includes('lightning')) {
        return 'linear-gradient(90deg, transparent 0%, rgba(120,180,255,0.35) 12%, rgba(200,230,255,0.9) 50%, rgba(120,180,255,0.35) 88%, transparent 100%)';
    }
    return 'linear-gradient(90deg, transparent 0%, rgba(255,80,0,0.45) 8%, rgba(255,160,40,0.85) 50%, rgba(255,80,0,0.45) 92%, transparent 100%)';
}

export const AoEEffectSprite: React.FC<AoEEffectSpriteProps> = ({
    effectId,
    theme,
    shape,
    width,
    height,
    opacity,
    tintColor,
    onMetaLoaded,
}) => {
    const [meta, setMeta] = useState<AoEEffectMeta | null>(null);
    const onMetaLoadedRef = useRef(onMetaLoaded);
    onMetaLoadedRef.current = onMetaLoaded;

    useEffect(() => {
        let cancelled = false;
        onMetaLoadedRef.current?.(false);
        void loadAoEEffectMeta(effectId, theme).then((loaded) => {
            if (!cancelled) {
                setMeta(loaded);
                onMetaLoadedRef.current?.(loaded !== null);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [effectId, theme]);

    const resolvedFit = useMemo((): AoEEffectMeta['fit'] => {
        if (!meta) return 'stretch';
        if (meta.fit) return meta.fit;
        if (shape === 'line') return 'line-fill';
        if (shape === 'cone') return 'cone';
        return 'stretch';
    }, [meta, shape]);

    const layout = useMemo(() => {
        if (!meta || width <= 0 || height <= 0) {
            return null;
        }

        const frameCount = meta.frameCount ?? 1;
        const fps = meta.fps ?? 12;
        if (!meta.frameCount || !meta.fps) {
            return null;
        }
        const durationSec = frameCount / fps;
        const sheetUrl = getAoEEffectSheetUrl(theme, effectId);
        const steps = Math.max(1, frameCount - 1);

        const containerBase: React.CSSProperties = {
            width: `${width}px`,
            height: `${height}px`,
            overflow: 'hidden',
            position: 'relative',
        };

        if (resolvedFit === 'ball') {
            const zoom = meta.zoom ?? 2.8;
            return {
                fit: resolvedFit,
                containerStyle: containerBase,
                zoom,
                spriteStyle: buildStretchSpriteStyle(
                    meta,
                    sheetUrl,
                    width,
                    height,
                    opacity,
                    durationSec,
                    steps,
                ),
            };
        }

        if (resolvedFit === 'line-fill') {
            const tile = Math.max(24, Math.round(height));
            const tileCount = Math.max(1, Math.ceil(width / tile));
            const zoom = meta.zoom ?? 2.4;
            return {
                fit: resolvedFit,
                containerStyle: containerBase,
                tile,
                tileCount,
                zoom,
                durationSec,
                steps,
                sheetUrl,
            };
        }

        if (resolvedFit === 'orbit') {
            const count = meta.orbitCount ?? 8;
            const spiritSize = Math.max(20, Math.min(56, Math.round(width / 5)));
            const radius = Math.max(spiritSize, width / 2 - spiritSize * 0.6);
            return {
                fit: resolvedFit,
                containerStyle: containerBase,
                orbit: { count, spiritSize, radius, durationSec, steps },
            };
        }

        if (resolvedFit === 'layered') {
            const layers = meta.layers ?? 3;
            const scales = [1.15, 1.35, 1];
            const opacities = [opacity * 0.75, opacity, opacity * 0.85];
            return {
                fit: resolvedFit,
                containerStyle: containerBase,
                layers: Array.from({ length: layers }, (_, i) => ({
                    style: {
                        ...buildStretchSpriteStyle(
                            meta,
                            sheetUrl,
                            width,
                            height,
                            opacities[i] ?? opacity,
                            durationSec,
                            steps,
                        ),
                        position: 'absolute' as const,
                        inset: 0,
                        transform: `scale(${scales[i] ?? 1})`,
                        transformOrigin: 'center center',
                    },
                })),
            };
        }

        if (resolvedFit === 'cone') {
            const scale = meta.scale ?? 1.65;
            return {
                fit: resolvedFit,
                containerStyle: containerBase,
                cone: {
                    scale,
                    innerStyle: {
                        position: 'absolute' as const,
                        left: '50%',
                        top: 0,
                        width: `${width * scale}px`,
                        height: `${height * scale}px`,
                        transform: 'translateX(-50%)',
                        transformOrigin: 'top center',
                    },
                    spriteStyle: buildStretchSpriteStyle(
                        meta,
                        sheetUrl,
                        width * scale,
                        height * scale,
                        opacity,
                        durationSec,
                        steps,
                    ),
                },
            };
        }

        return {
            fit: resolvedFit,
            containerStyle: containerBase,
            spriteStyle: buildStretchSpriteStyle(
                meta,
                sheetUrl,
                width,
                height,
                opacity,
                durationSec,
                steps,
            ),
        };
    }, [meta, width, height, effectId, theme, opacity, resolvedFit]);

    if (!layout) {
        return null;
    }

    const clipPath =
        shape === 'cone'
            ? coneClipPath()
            : shape === 'circle' || shape === 'cylinder'
              ? 'circle(50% at 50% 50%)'
              : undefined;

    const clippedStyle: React.CSSProperties = clipPath
        ? { ...layout.containerStyle, clipPath, WebkitClipPath: clipPath }
        : layout.containerStyle;

    const tintOverlay = tintColor ? (
        <div
            className="pointer-events-none absolute inset-0"
            style={{
                backgroundColor: tintColor,
                opacity: 0.1,
                mixBlendMode: 'multiply',
            }}
        />
    ) : null;

    if (layout.fit === 'ball' && layout.spriteStyle && meta) {
        const zoom = layout.zoom ?? 2.8;
        return (
            <div style={clippedStyle} aria-hidden>
                <div
                    className="pointer-events-none absolute inset-0 aoe-fireball-glow"
                    style={{
                        background: ballGlow(effectId),
                        opacity: opacity * 0.9,
                        mixBlendMode: 'screen',
                    }}
                />
                <div className="absolute inset-0 overflow-hidden">
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            transform: `scale(${zoom})`,
                            transformOrigin: 'center center',
                        }}
                    >
                        <div style={layout.spriteStyle} />
                    </div>
                </div>
                {tintOverlay}
            </div>
        );
    }

    if (layout.fit === 'line-fill' && meta && layout.tile && layout.tileCount) {
        const { tile, tileCount, zoom, durationSec, steps, sheetUrl } = layout;
        const glow = lineGlow(effectId);
        return (
            <div style={clippedStyle} aria-hidden>
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: glow,
                        opacity: opacity * 0.85,
                        mixBlendMode: 'screen',
                    }}
                />
                <div
                    className="absolute inset-0 flex"
                    style={{ height: '100%' }}
                >
                    {Array.from({ length: tileCount }).map((_, i) => (
                        <div
                            key={i}
                            style={{
                                width: `${tile}px`,
                                height: '100%',
                                flexShrink: 0,
                                overflow: 'hidden',
                                position: 'relative',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '50%',
                                    top: '50%',
                                    width: `${tile}px`,
                                    height: `${tile}px`,
                                    marginLeft: `-${tile / 2}px`,
                                    marginTop: `-${tile / 2}px`,
                                    transform: `scale(${zoom})`,
                                    transformOrigin: 'center center',
                                }}
                            >
                                <div
                                    style={buildStretchSpriteStyle(
                                        meta,
                                        sheetUrl,
                                        tile,
                                        tile,
                                        opacity,
                                        durationSec,
                                        steps,
                                        (i / tileCount) * (durationSec * 0.4),
                                    )}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                {tintOverlay}
            </div>
        );
    }

    if (layout.fit === 'orbit' && layout.orbit && meta) {
        const { count, spiritSize, radius, durationSec, steps } = layout.orbit;
        const sheetUrl = getAoEEffectSheetUrl(theme, effectId);
        const orbitDuration = 9;
        return (
            <div style={clippedStyle} aria-hidden>
                <div
                    className="absolute left-1/2 top-1/2 h-0 w-0"
                    style={{
                        animation: `aoe-orbit-spin ${orbitDuration}s linear infinite`,
                    }}
                >
                    {Array.from({ length: count }).map((_, i) => {
                        const angle = (360 / count) * i;
                        return (
                            <div
                                key={i}
                                style={{
                                    position: 'absolute',
                                    width: spiritSize,
                                    height: spiritSize,
                                    left: -spiritSize / 2,
                                    top: -spiritSize / 2,
                                    transform: `rotate(${angle}deg) translateY(-${radius}px)`,
                                    transformOrigin: 'center center',
                                }}
                            >
                                <div
                                    style={{
                                        width: spiritSize,
                                        height: spiritSize,
                                        animation: `aoe-orbit-counter ${orbitDuration}s linear infinite`,
                                    }}
                                >
                                    <div
                                        style={buildOrbitSpiritStyle(
                                            meta,
                                            sheetUrl,
                                            spiritSize,
                                            opacity,
                                            durationSec * 0.85,
                                            steps,
                                            (i / count) * (durationSec * 0.5),
                                        )}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
                {tintOverlay}
            </div>
        );
    }

    if (layout.fit === 'layered' && layout.layers) {
        return (
            <div style={clippedStyle} aria-hidden>
                {layout.layers.map((layer, i) => (
                    <div key={i} style={layer.style} />
                ))}
                {tintOverlay}
            </div>
        );
    }

    if (layout.fit === 'cone' && layout.cone) {
        return (
            <div style={clippedStyle} aria-hidden>
                <div style={layout.cone.innerStyle}>
                    <div style={layout.cone.spriteStyle} />
                </div>
                {tintOverlay}
            </div>
        );
    }

    return (
        <div style={clippedStyle} aria-hidden>
            <div style={layout.spriteStyle} />
            {tintOverlay}
        </div>
    );
};
