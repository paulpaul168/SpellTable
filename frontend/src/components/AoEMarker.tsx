import React, { useState, useRef, useEffect, useCallback, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AoEMarker as AoEMarkerType } from '../types/map';
import {
    getPlayAreaRect,
    pointerToAoEPosition,
    toDisplayPixels,
} from '@/utils/aoeCoordinates';
import { AoEEffectSprite } from './AoEEffectSprite';
import { AoEEffectVideo } from './AoEEffectVideo';
import { normalizeAoEEffectTheme, prefetchAoEEffectMeta } from '@/lib/aoeEffects';
import type { AoEEffectTheme } from '@/types/aoeEffect';
import { DEFAULT_AOE_EFFECT_THEME } from '@/types/aoeEffect';

interface AoEMarkerProps {
    marker: AoEMarkerType;
    gridSize: number;
    isActive: boolean;
    isAdmin: boolean;
    onUpdate: (updatedMarker: AoEMarkerType) => void;
    onDelete: (markerId: string) => void;
    scale?: number;
    gridSettings?: {
        useFixedGrid?: boolean;
        gridCellsX?: number;
        gridCellsY?: number;
        gridSize: number;
        aoeSnapToGrid?: boolean;
        aoeEffectTheme?: AoEEffectTheme;
        aoeStagedReveal?: boolean;
    };
    isHighlighted?: boolean;
    containerRef?: RefObject<HTMLElement | null>;
    onTrigger?: (markerId: string) => void;
}

let closeOtherAoEMenus: (() => void) | null = null;

export const AoEMarker: React.FC<AoEMarkerProps> = ({
    marker,
    gridSize,
    isActive,
    isAdmin,
    onUpdate,
    onDelete,
    scale = 1,
    gridSettings,
    isHighlighted = false,
    containerRef,
    onTrigger,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showSizeIndicator, setShowSizeIndicator] = useState(false);
    const [highlightAnimation, setHighlightAnimation] = useState(false);
    const [highlightRippleKey, setHighlightRippleKey] = useState(0);
    const [effectLoaded, setEffectLoaded] = useState(false);
    const [playRevealAnimation, setPlayRevealAnimation] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const prevRevealedRef = useRef(marker.revealed);
    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<AoEMarkerType | null>(null);
    const mouseDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const markerRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef(marker.position);
    const isDraggingRef = useRef(false);
    const ctrlHeldRef = useRef(false);
    const lastPointerClientRef = useRef({ x: 0, y: 0 });
    const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

    const useFixedGrid = gridSettings?.useFixedGrid || false;
    const gridCellsX = gridSettings?.gridCellsX || 25;
    const gridCellsY = gridSettings?.gridCellsY || 13;

    const getContainerRect = useCallback(() => {
        return getPlayAreaRect(containerRef?.current ?? null);
    }, [containerRef]);

    const getCellSizes = useCallback((containerRect: DOMRect) => {
        return {
            cellWidth: containerRect.width / gridCellsX,
            cellHeight: containerRect.height / gridCellsY,
        };
    }, [gridCellsX, gridCellsY]);

    const { cellWidth, cellHeight } = getCellSizes(getContainerRect());

    const effectiveGridSize = useFixedGrid
        ? Math.min(cellWidth, cellHeight)
        : gridSize;

    const aoeSnapToGrid = gridSettings?.aoeSnapToGrid !== false;
    const aoeEffectTheme = normalizeAoEEffectTheme(
        gridSettings?.aoeEffectTheme ?? DEFAULT_AOE_EFFECT_THEME,
    );
    const aoeStagedReveal = gridSettings?.aoeStagedReveal === true;
    const isHiddenFromViewer = !isAdmin && aoeStagedReveal && marker.revealed === false;
    const isLongEffectGhost =
        isAdmin &&
        aoeStagedReveal &&
        marker.revealed === false &&
        (marker.shape === 'line' || marker.shape === 'cone');
    const canTrigger =
        isAdmin && aoeStagedReveal && marker.revealed === false && onTrigger;

    const sizeInPixels = marker.sizeInFeet * effectiveGridSize / 5;
    const adjustedSizeInPixels = sizeInPixels;

    useEffect(() => {
        if (marker.effectId && aoeEffectTheme !== 'none') {
            prefetchAoEEffectMeta(marker.effectId, aoeEffectTheme);
            setEffectLoaded(false);
        }
    }, [marker.effectId, aoeEffectTheme]);

    useEffect(() => {
        if (isHighlighted) {
            queueMicrotask(() => {
                setHighlightRippleKey((k) => k + 1);
                setHighlightAnimation(true);
            });

            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }

            highlightTimerRef.current = setTimeout(() => {
                setHighlightAnimation(false);
                highlightTimerRef.current = null;
            }, 3500);
        }
    }, [isHighlighted]);

    useEffect(() => {
        if (!aoeStagedReveal) {
            prevRevealedRef.current = marker.revealed;
            return;
        }
        const wasUnrevealed = prevRevealedRef.current === false;
        const nowRevealed = marker.revealed !== false;
        if (wasUnrevealed && nowRevealed && !isAdmin) {
            setPlayRevealAnimation(true);
        }
        prevRevealedRef.current = marker.revealed;
    }, [marker.revealed, aoeStagedReveal, isAdmin]);

    const closeThisMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    useEffect(() => {
        return () => {
            if (closeOtherAoEMenus === closeThisMenu) {
                closeOtherAoEMenus = null;
            }
        };
    }, [closeThisMenu]);

    useEffect(() => {
        if (!contextMenu) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (e.button === 2) return;
            const target = e.target as Node;
            if (markerRef.current?.contains(target)) return;
            if (
                target instanceof Element &&
                target.closest('[data-aoe-context-menu]')
            ) {
                return;
            }
            setContextMenu(null);
        };

        const handleScroll = () => setContextMenu(null);
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null);
        };

        const timerId = window.setTimeout(() => {
            document.addEventListener('pointerdown', handlePointerDown, true);
            document.addEventListener('scroll', handleScroll, true);
            document.addEventListener('keydown', handleKeyDown);
        }, 0);

        return () => {
            window.clearTimeout(timerId);
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('scroll', handleScroll, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [contextMenu]);

    useEffect(() => {
        return () => {
            if (resizeTimerRef.current) {
                clearTimeout(resizeTimerRef.current);
            }
            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }
        };
    }, []);

    const calculatePosition = useCallback(() => {
        const containerRect = getContainerRect();
        return toDisplayPixels(marker, gridSettings, containerRect, gridCellsX, gridCellsY);
    }, [marker, gridSettings, getContainerRect, gridCellsX, gridCellsY]);

    const [currentPos, setCurrentPos] = useState(calculatePosition());

    useEffect(() => {
        positionRef.current = currentPos;
    }, [currentPos]);

    useEffect(() => {
        if (isDraggingRef.current) {
            return;
        }

        const updatePosition = () => {
            const newPosition = calculatePosition();
            setCurrentPos(newPosition);
            positionRef.current = newPosition;
        };

        updatePosition();

        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('resize', updatePosition);
        };
    }, [marker.position, marker.useGridCoordinates, calculatePosition]);

    const throttledUpdate = useCallback((newMarker: AoEMarkerType) => {
        const now = performance.now();
        if (now - lastUpdateRef.current >= 32) {
            onUpdate(newMarker);
            lastUpdateRef.current = now;
            pendingUpdateRef.current = null;
        } else {
            pendingUpdateRef.current = newMarker;
            if (!lastUpdateRef.current) {
                requestAnimationFrame(() => {
                    const pendingMarker = pendingUpdateRef.current;
                    if (pendingMarker) {
                        onUpdate(pendingMarker);
                        pendingUpdateRef.current = null;
                    }
                    lastUpdateRef.current = performance.now();
                });
            }
        }
    }, [onUpdate]);

    const applyDragAtClient = useCallback(
        (clientX: number, clientY: number, ctrlKey: boolean) => {
            const containerRect = getContainerRect();
            const containerRelativeX =
                clientX - containerRect.left - mouseDragOffsetRef.current.x;
            const containerRelativeY =
                clientY - containerRect.top - mouseDragOffsetRef.current.y;

            const snapDisplay = aoeSnapToGrid || ctrlKey;
            const { position, useGridCoordinates, displayPixels } = pointerToAoEPosition(
                containerRelativeX,
                containerRelativeY,
                snapDisplay,
                aoeSnapToGrid,
                containerRect,
                gridCellsX,
                gridCellsY
            );

            setCurrentPos(displayPixels);
            positionRef.current = displayPixels;

            throttledUpdate({
                ...marker,
                position,
                useGridCoordinates,
            });
        },
        [marker, getContainerRect, gridCellsX, gridCellsY, throttledUpdate, aoeSnapToGrid]
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDraggingRef.current) return;

            e.preventDefault();
            e.stopPropagation();

            lastPointerClientRef.current = { x: e.clientX, y: e.clientY };
            ctrlHeldRef.current = e.ctrlKey;
            applyDragAtClient(e.clientX, e.clientY, e.ctrlKey);
        },
        [applyDragAtClient]
    );

    const handleMouseUp = useCallback(
        (e: MouseEvent) => {
            if (!isDraggingRef.current) return;

            e.preventDefault();

            const containerRect = getContainerRect();
            const containerRelativeX =
                e.clientX - containerRect.left - mouseDragOffsetRef.current.x;
            const containerRelativeY =
                e.clientY - containerRect.top - mouseDragOffsetRef.current.y;
            const snapDisplay = aoeSnapToGrid || e.ctrlKey;
            const { position, useGridCoordinates, displayPixels } = pointerToAoEPosition(
                containerRelativeX,
                containerRelativeY,
                snapDisplay,
                aoeSnapToGrid,
                containerRect,
                gridCellsX,
                gridCellsY
            );
            const finalMarker: AoEMarkerType = {
                ...marker,
                position,
                useGridCoordinates,
            };

            onUpdate(finalMarker);
            pendingUpdateRef.current = null;
            lastUpdateRef.current = performance.now();
            setCurrentPos(displayPixels);
            positionRef.current = displayPixels;

            setIsDragging(false);
            isDraggingRef.current = false;
            ctrlHeldRef.current = false;
            document.body.classList.remove('dragging-aoe');
        },
        [marker, onUpdate, getContainerRect, gridSettings, gridCellsX, gridCellsY, aoeSnapToGrid]
    );

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
        const handleGlobalMouseUp = (e: MouseEvent) => handleMouseUp(e);
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDraggingRef.current) {
                setIsDragging(false);
                isDraggingRef.current = false;
                ctrlHeldRef.current = false;
                document.body.classList.remove('dragging-aoe');
                return;
            }
            if (
                isDraggingRef.current &&
                !aoeSnapToGrid &&
                e.key === 'Control' &&
                !ctrlHeldRef.current
            ) {
                ctrlHeldRef.current = true;
                const { x, y } = lastPointerClientRef.current;
                applyDragAtClient(x, y, true);
            }
        };

        const handleGlobalKeyUp = (e: KeyboardEvent) => {
            if (
                isDraggingRef.current &&
                !aoeSnapToGrid &&
                e.key === 'Control' &&
                ctrlHeldRef.current
            ) {
                ctrlHeldRef.current = false;
                const { x, y } = lastPointerClientRef.current;
                applyDragAtClient(x, y, false);
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove, { capture: true });
        window.addEventListener('mouseup', handleGlobalMouseUp, { capture: true });
        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove, { capture: true });
            window.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true });
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('keyup', handleGlobalKeyUp);
            document.body.classList.remove('dragging-aoe');
        };
    }, [handleMouseMove, handleMouseUp, applyDragAtClient, aoeSnapToGrid]);

    useEffect(() => {
        isDraggingRef.current = isDragging;
        if (isDragging) {
            document.body.classList.add('dragging-aoe');
        } else {
            document.body.classList.remove('dragging-aoe');
        }
    }, [isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || !isAdmin) return;

        if (e.button === 2) {
            e.stopPropagation();
            return;
        }
        if (e.button !== 0) return;

        e.stopPropagation();
        e.preventDefault();

        const containerRect = getContainerRect();
        const display = toDisplayPixels(marker, gridSettings, containerRect, gridCellsX, gridCellsY);
        const mouseRelX = e.clientX - containerRect.left;
        const mouseRelY = e.clientY - containerRect.top;

        mouseDragOffsetRef.current = {
            x: mouseRelX - display.x,
            y: mouseRelY - display.y,
        };

        lastPointerClientRef.current = { x: e.clientX, y: e.clientY };
        ctrlHeldRef.current = e.ctrlKey;

        setIsDragging(true);
        isDraggingRef.current = true;
        document.body.classList.add('dragging-aoe');
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!isActive || !isAdmin) return;
        e.stopPropagation();
        e.preventDefault();

        if (!e.shiftKey) {
            setIsResizing(true);
            setShowSizeIndicator(true);

            if (resizeTimerRef.current) {
                clearTimeout(resizeTimerRef.current);
            }

            resizeTimerRef.current = setTimeout(() => {
                setIsResizing(false);
                setShowSizeIndicator(false);
                resizeTimerRef.current = null;
            }, 1500);
        }

        if (e.shiftKey) {
            const delta = e.deltaY > 0 ? -5 : 5;
            const newRotation = (marker.rotation + delta) % 360;

            onUpdate({
                ...marker,
                rotation: newRotation
            });
        } else {
            const delta = e.deltaY > 0 ? -5 : 5;
            const newSize = Math.max(5, marker.sizeInFeet + delta);

            onUpdate({
                ...marker,
                sizeInFeet: newSize
            });
        }
    };

    const effectHeight =
        marker.shape === 'line'
            ? effectiveGridSize / 2
            : adjustedSizeInPixels;

    const effectWidth = adjustedSizeInPixels;

    const shapeBoundsStyle: React.CSSProperties =
        marker.shape === 'cone'
            ? {
                  position: 'relative',
                  width: `${effectWidth}px`,
                  height: `${effectHeight}px`,
                  transform: 'translateX(-50%)',
              }
            : {
                  position: 'relative',
                  width: `${effectWidth}px`,
                  height: `${effectHeight}px`,
              };

    const renderEffectSprite = () => {
        if (!marker.effectId || aoeEffectTheme === 'none') {
            return null;
        }
        return (
            <div
                className="pointer-events-none absolute left-0 top-0"
                style={{ width: effectWidth, height: effectHeight }}
            >
                {aoeEffectTheme === 'realistic' ? (
                    <AoEEffectVideo
                        effectId={marker.effectId}
                        theme={aoeEffectTheme}
                        shape={marker.shape}
                        width={effectWidth}
                        height={effectHeight}
                        opacity={marker.opacity}
                        onMetaLoaded={setEffectLoaded}
                    />
                ) : (
                    <AoEEffectSprite
                        effectId={marker.effectId}
                        theme={aoeEffectTheme}
                        shape={marker.shape}
                        width={effectWidth}
                        height={effectHeight}
                        opacity={marker.opacity}
                        tintColor={marker.color}
                        onMetaLoaded={setEffectLoaded}
                    />
                )}
            </div>
        );
    };

    const getRevealClass = (): string => {
        if (!playRevealAnimation) return '';
        if (marker.shape === 'cone') return 'aoe-reveal-cone';
        if (marker.shape === 'line') return 'aoe-reveal-line';
        return 'aoe-reveal-center';
    };

    const renderAnchorDot = () => (
        <div
            className="pointer-events-none absolute z-10 rounded-full border border-black/60 bg-white shadow-sm"
            style={{
                width: 8,
                height: 8,
                ...(marker.shape === 'cone'
                    ? { top: 0, left: '50%', transform: 'translate(-50%, -50%)' }
                    : { left: 0, top: '50%', transform: 'translate(-50%, -50%)' }),
            }}
        />
    );

    const renderGhostShape = () => {
        const ghostOpacity = 0.35;
        switch (marker.shape) {
            case 'circle':
                return (
                    <div
                        className="rounded-full border-2 border-dashed"
                        style={{
                            width: `${adjustedSizeInPixels}px`,
                            height: `${adjustedSizeInPixels}px`,
                            borderColor: marker.color,
                            backgroundColor: `${marker.color}18`,
                            opacity: ghostOpacity,
                        }}
                    />
                );
            case 'cone':
                return (
                    <svg
                        width={adjustedSizeInPixels}
                        height={adjustedSizeInPixels}
                        style={{ opacity: ghostOpacity }}
                        viewBox={`0 0 ${adjustedSizeInPixels} ${adjustedSizeInPixels}`}
                    >
                        <polygon
                            points={`${adjustedSizeInPixels / 2},0 0,${adjustedSizeInPixels} ${adjustedSizeInPixels},${adjustedSizeInPixels}`}
                            fill={`${marker.color}18`}
                            stroke={marker.color}
                            strokeWidth="2"
                            strokeDasharray="6 4"
                        />
                    </svg>
                );
            case 'line':
                return (
                    <div
                        className="border-2 border-dashed"
                        style={{
                            width: `${adjustedSizeInPixels}px`,
                            height: `${effectiveGridSize / 2}px`,
                            borderColor: marker.color,
                            backgroundColor: `${marker.color}18`,
                            opacity: ghostOpacity,
                        }}
                    />
                );
            case 'square':
            case 'cube':
                return (
                    <div
                        className="border-2 border-dashed"
                        style={{
                            width: `${adjustedSizeInPixels}px`,
                            height: `${adjustedSizeInPixels}px`,
                            borderColor: marker.color,
                            backgroundColor: `${marker.color}18`,
                            opacity: ghostOpacity,
                        }}
                    />
                );
            case 'cylinder':
                return (
                    <div
                        className="rounded-full border-2 border-dashed"
                        style={{
                            width: `${adjustedSizeInPixels}px`,
                            height: `${adjustedSizeInPixels}px`,
                            borderColor: marker.color,
                            backgroundColor: `${marker.color}18`,
                            opacity: ghostOpacity,
                        }}
                    />
                );
            default:
                return null;
        }
    };

    const renderSolidShape = () => {
        switch (marker.shape) {
            case 'circle':
                return (
                    <div
                        className="rounded-full"
                        style={{
                            width: `${adjustedSizeInPixels}px`,
                            height: `${adjustedSizeInPixels}px`,
                            backgroundColor: marker.color,
                            opacity: marker.opacity
                        }}
                    />
                );
            case 'cone':
                return (
                    <svg
                        width={adjustedSizeInPixels}
                        height={adjustedSizeInPixels}
                        style={{ opacity: marker.opacity }}
                        viewBox={`0 0 ${adjustedSizeInPixels} ${adjustedSizeInPixels}`}
                    >
                        <polygon
                            points={`${adjustedSizeInPixels / 2},0 0,${adjustedSizeInPixels} ${adjustedSizeInPixels},${adjustedSizeInPixels}`}
                            fill={marker.color}
                        />
                    </svg>
                );
            case 'line':
                return (
                    <div
                        style={{
                            width: `${adjustedSizeInPixels}px`,
                            height: `${effectiveGridSize / 2}px`,
                            backgroundColor: marker.color,
                            opacity: marker.opacity
                        }}
                    />
                );
            case 'square':
            case 'cube':
                return (
                    <div
                        style={{
                            width: `${adjustedSizeInPixels}px`,
                            height: `${adjustedSizeInPixels}px`,
                            backgroundColor: marker.color,
                            opacity: marker.opacity
                        }}
                    />
                );
            case 'cylinder':
                return (
                    <div className="relative">
                        <div
                            className="rounded-full"
                            style={{
                                width: `${adjustedSizeInPixels}px`,
                                height: `${adjustedSizeInPixels}px`,
                                backgroundColor: marker.color,
                                opacity: marker.opacity
                            }}
                        />
                        <div
                            className="absolute top-1/4 left-1/4 rounded-full border-2"
                            style={{
                                width: `${adjustedSizeInPixels / 2}px`,
                                height: `${adjustedSizeInPixels / 2}px`,
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                                opacity: marker.opacity
                            }}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    const renderShape = () => {
        if (isLongEffectGhost) {
            return (
                <div style={shapeBoundsStyle} className="relative">
                    {renderGhostShape()}
                    {renderAnchorDot()}
                </div>
            );
        }

        const showSolid =
            aoeEffectTheme === 'none' || !marker.effectId || !effectLoaded;
        return (
            <div
                style={shapeBoundsStyle}
                className={getRevealClass()}
                onAnimationEnd={() => setPlayRevealAnimation(false)}
            >
                {showSolid && renderSolidShape()}
                {renderEffectSprite()}
            </div>
        );
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (!isAdmin) return;
        e.stopPropagation();
        onDelete(marker.id);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!isAdmin || !canTrigger) return;
        e.preventDefault();
        e.stopPropagation();
        closeOtherAoEMenus?.();
        closeOtherAoEMenus = closeThisMenu;
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleTrigger = () => {
        onTrigger?.(marker.id);
        setContextMenu(null);
    };

    if (isHiddenFromViewer) {
        return null;
    }

    return (
        <div
            ref={markerRef}
            className={`absolute select-none ${highlightAnimation ? 'highlighted-marker' : ''}`}
            style={{
                position: 'absolute',
                left: `${currentPos.x}px`,
                top: `${currentPos.y}px`,
                width: marker.shape !== 'cone' ? effectWidth : undefined,
                height: marker.shape !== 'cone' ? effectHeight : undefined,
                transform: marker.shape === 'cone'
                    ? `rotate(${marker.rotation}deg)`
                    : `translate(-50%, -50%) rotate(${marker.rotation}deg)`,
                transformOrigin: marker.shape === 'cone' ? 'center top' : 'center',
                cursor: isActive && isAdmin ? (isDragging ? 'grabbing' : 'grab') : 'default',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: isDragging ? 900 : 500,
                touchAction: 'none'
            }}
            title={canTrigger ? 'Right-click to trigger' : undefined}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onMouseEnter={() => !isDragging && setIsHovered(true)}
            onMouseLeave={() => !isDragging && setIsHovered(false)}
        >
            {highlightAnimation && (
                <div key={highlightRippleKey}>
                    {marker.shape === 'cone' ? (
                        <svg
                            className="animate-ripple-cone-1"
                            width={adjustedSizeInPixels}
                            height={adjustedSizeInPixels + 30}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                transform: 'translateX(-50%)',
                            }}
                            viewBox={`${-adjustedSizeInPixels * 0.1} ${-adjustedSizeInPixels * 0.1} ${adjustedSizeInPixels * 1.2} ${adjustedSizeInPixels * 1.2 + 30}`}
                        >
                            <polygon
                                points={`${adjustedSizeInPixels / 2},0 ${-adjustedSizeInPixels * 0.1},${adjustedSizeInPixels * 1.1} ${adjustedSizeInPixels * 1.1},${adjustedSizeInPixels * 1.1}`}
                                fill="none"
                                stroke={marker.color}
                                strokeWidth="2"
                            />
                        </svg>
                    ) : (
                        <div
                            className={`absolute animate-ripple-1 ${marker.shape === 'circle' || marker.shape === 'cylinder' ? 'rounded-full' : ''}`}
                            style={{
                                width: `${adjustedSizeInPixels * 1.2}px`,
                                height: marker.shape === 'line' ? `${effectiveGridSize / 2 * 1.2}px` : `${adjustedSizeInPixels * 1.2}px`,
                                border: `2px solid ${marker.color}`,
                                transform: 'translate(-50%, -50%)',
                                left: '50%',
                                top: '50%',

                            }}
                        />
                    )}

                    {marker.shape === 'cone' ? (
                        <svg
                            className="animate-ripple-cone-2"
                            width={adjustedSizeInPixels}
                            height={adjustedSizeInPixels + 30}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                transform: 'translateX(-50%)',
                            }}
                            viewBox={`${-adjustedSizeInPixels * 0.2} ${-adjustedSizeInPixels * 0.2} ${adjustedSizeInPixels * 1.4} ${adjustedSizeInPixels * 1.4 + 30}`}
                        >
                            <polygon
                                points={`${adjustedSizeInPixels / 2},0 ${-adjustedSizeInPixels * 0.2},${adjustedSizeInPixels * 1.2} ${adjustedSizeInPixels * 1.2},${adjustedSizeInPixels * 1.2}`}
                                fill="none"
                                stroke={marker.color}
                                strokeWidth="2"
                            />
                        </svg>
                    ) : (
                        <div
                            className={`absolute animate-ripple-2 ${marker.shape === 'circle' || marker.shape === 'cylinder' ? 'rounded-full' : ''}`}
                            style={{
                                width: `${adjustedSizeInPixels * 1.4}px`,
                                height: marker.shape === 'line' ? `${effectiveGridSize / 2 * 1.4}px` : `${adjustedSizeInPixels * 1.4}px`,
                                border: `2px solid ${marker.color}`,
                                transform: 'translate(-50%, -50%)',
                                left: '50%',
                                top: '50%',

                            }}
                        />
                    )}

                    {marker.shape === 'cone' ? (
                        <svg
                            className="animate-ripple-cone-3"
                            width={adjustedSizeInPixels}
                            height={adjustedSizeInPixels + 30}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                transform: 'translateX(-50%)',
                            }}
                            viewBox={`${-adjustedSizeInPixels * 0.3} ${-adjustedSizeInPixels * 0.3} ${adjustedSizeInPixels * 1.6} ${adjustedSizeInPixels * 1.6 + 30}`}
                        >
                            <polygon
                                points={`${adjustedSizeInPixels / 2},0 ${-adjustedSizeInPixels * 0.3},${adjustedSizeInPixels * 1.3} ${adjustedSizeInPixels * 1.3},${adjustedSizeInPixels * 1.3}`}
                                fill="none"
                                stroke={marker.color}
                                strokeWidth="2"
                            />
                        </svg>
                    ) : (
                        <div
                            className={`absolute animate-ripple-3 ${marker.shape === 'circle' || marker.shape === 'cylinder' ? 'rounded-full' : ''}`}
                            style={{
                                width: `${adjustedSizeInPixels * 1.6}px`,
                                height: marker.shape === 'line' ? `${effectiveGridSize / 2 * 1.6}px` : `${adjustedSizeInPixels * 1.6}px`,
                                border: `2px solid ${marker.color}`,
                                transform: 'translate(-50%, -50%)',
                                left: '50%',
                                top: '50%',

                            }}
                        />
                    )}
                </div>
            )}

            {isAdmin && showSizeIndicator && (
                <div className={`absolute ${marker.shape === 'cone' ? 'bottom-0 left-0 translate-y-full ml-2' : 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full'} mt-1 px-2 py-1 bg-black/80 text-white text-xs rounded pointer-events-none`}>
                    {marker.sizeInFeet}′
                </div>
            )}

            {renderShape()}

            {contextMenu &&
                isAdmin &&
                createPortal(
                    <div
                        data-aoe-context-menu
                        role="menu"
                        className="fixed z-[10002] min-w-[11rem] overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                            onClick={handleTrigger}
                        >
                            Trigger (reveal to viewers)
                        </button>
                    </div>,
                    document.body,
                )}

            {marker.label && (
                <div
                    className="absolute px-2 py-1 bg-black/70 text-white text-xs rounded pointer-events-none"
                    style={{
                        whiteSpace: 'nowrap',
                        top: `${effectHeight + 4}px`,
                        left: marker.shape === 'cone' ? '0' : '50%',
                        transform: marker.shape === 'cone' ? 'translateX(-50%)' : 'translateX(-50%)',
                    }}
                >
                    {marker.label}
                </div>
            )}

            <style jsx>{`
                @keyframes ripple-1 {
                    0% {
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 0.8;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(1.5);
                        opacity: 0;
                    }
                }
                @keyframes ripple-2 {
                    0% {
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 0.6;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(1.5);
                        opacity: 0;
                    }
                }
                @keyframes ripple-3 {
                    0% {
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 0.4;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(1.5);
                        opacity: 0;
                    }
                }
                @keyframes ripple-cone-1 {
                    0% {
                        transform: translateX(-50%) scale(1);
                        opacity: 0.8;
                    }
                    100% {
                        transform: translateX(-50%) scale(1.5);
                        opacity: 0;
                    }
                }
                @keyframes ripple-cone-2 {
                    0% {
                        transform: translateX(-50%) scale(1);
                        opacity: 0.6;
                    }
                    100% {
                        transform: translateX(-50%) scale(1.5);
                        opacity: 0;
                    }
                }
                @keyframes ripple-cone-3 {
                    0% {
                        transform: translateX(-50%) scale(1);
                        opacity: 0.4;
                    }
                    100% {
                        transform: translateX(-50%) scale(1.5);
                        opacity: 0;
                    }
                }
                .animate-ripple-1 {
                    animation: ripple-1 1.5s ease-out 2 forwards;
                }
                .animate-ripple-2 {
                    animation: ripple-2 1.5s ease-out 0.2s 2 forwards;
                }
                .animate-ripple-3 {
                    animation: ripple-3 1.5s ease-out 0.4s 2 forwards;
                }
                .animate-ripple-cone-1 {
                    animation: ripple-cone-1 1.5s ease-out 2 forwards;
                }
                .animate-ripple-cone-2 {
                    animation: ripple-cone-2 1.5s ease-out 0.2s 2 forwards;
                }
                .animate-ripple-cone-3 {
                    animation: ripple-cone-3 1.5s ease-out 0.4s 2 forwards;
                }
                .highlighted-marker {
                    z-index: 800;
                }
            `}</style>
        </div>
    );
};
