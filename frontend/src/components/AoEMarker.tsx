import React, { useState, useRef, useEffect, useCallback, RefObject } from 'react';
import { AoEMarker as AoEMarkerType } from '../types/map';
import {
    fromContainerPointer,
    getPlayAreaRect,
    toDisplayPixels,
} from '@/utils/aoeCoordinates';

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
    };
    isHighlighted?: boolean;
    containerRef?: RefObject<HTMLElement | null>;
}

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
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showSizeIndicator, setShowSizeIndicator] = useState(false);
    const [highlightAnimation, setHighlightAnimation] = useState(false);
    const [highlightRippleKey, setHighlightRippleKey] = useState(0);
    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<AoEMarkerType | null>(null);
    const mouseDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const markerRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef(marker.position);
    const isDraggingRef = useRef(false);
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

    const sizeInPixels = marker.sizeInFeet * effectiveGridSize / 5;
    const adjustedSizeInPixels = sizeInPixels;

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

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        const containerRect = getContainerRect();
        const containerRelativeX =
            e.clientX - containerRect.left - mouseDragOffsetRef.current.x;
        const containerRelativeY =
            e.clientY - containerRect.top - mouseDragOffsetRef.current.y;

        const snapNow = aoeSnapToGrid || e.ctrlKey;
        const { position, useGridCoordinates, displayPixels } = fromContainerPointer(
            containerRelativeX,
            containerRelativeY,
            snapNow,
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
    }, [marker, getContainerRect, gridCellsX, gridCellsY, throttledUpdate, aoeSnapToGrid]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (isDraggingRef.current) {
            e.preventDefault();
            if (pendingUpdateRef.current) {
                onUpdate(pendingUpdateRef.current);
                pendingUpdateRef.current = null;
            }
            setIsDragging(false);
            isDraggingRef.current = false;
            document.body.classList.remove('dragging-aoe');
        }
    }, [onUpdate]);

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
        const handleGlobalMouseUp = (e: MouseEvent) => handleMouseUp(e);
        const handleGlobalEscapeKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDraggingRef.current) {
                setIsDragging(false);
                isDraggingRef.current = false;
                document.body.classList.remove('dragging-aoe');
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove, { capture: true });
        window.addEventListener('mouseup', handleGlobalMouseUp, { capture: true });
        window.addEventListener('keydown', handleGlobalEscapeKey);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove, { capture: true });
            window.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true });
            window.removeEventListener('keydown', handleGlobalEscapeKey);
            document.body.classList.remove('dragging-aoe');
        };
    }, [handleMouseMove, handleMouseUp]);

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

    const renderShape = () => {
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
                        height={adjustedSizeInPixels + 30}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            transform: 'translateX(-50%)',
                            opacity: marker.opacity
                        }}
                        viewBox={`0 0 ${adjustedSizeInPixels} ${adjustedSizeInPixels + 30}`}
                    >
                        <polygon
                            points={`${adjustedSizeInPixels / 2},0 0,${adjustedSizeInPixels} ${adjustedSizeInPixels},${adjustedSizeInPixels}`}
                            fill={marker.color}
                        />
                        {marker.label && (
                            <text
                                x={adjustedSizeInPixels / 2}
                                y={adjustedSizeInPixels + 20}
                                textAnchor="middle"
                                fill="white"
                                className="text-xs"
                                style={{
                                    fontSize: '12px',
                                    fontFamily: 'sans-serif',
                                    textShadow: '0 0 3px rgba(0,0,0,0.8)'
                                }}
                            >
                                {marker.label}
                            </text>
                        )}
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

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (!isAdmin) return;
        e.stopPropagation();
        onDelete(marker.id);
    };

    return (
        <div
            ref={markerRef}
            className={`absolute select-none ${highlightAnimation ? 'highlighted-marker' : ''}`}
            style={{
                position: 'absolute',
                left: `${currentPos.x}px`,
                top: `${currentPos.y}px`,
                transform: marker.shape === 'cone'
                    ? `rotate(${marker.rotation}deg)`
                    : `translate(-50%, -50%) rotate(${marker.rotation}deg)`,
                transformOrigin: marker.shape === 'cone' ? 'center top' : 'center',
                cursor: isActive && isAdmin ? (isDragging ? 'grabbing' : 'grab') : 'default',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: isDragging ? 900 : 500,
                touchAction: 'none'
            }}
            onMouseDown={handleMouseDown}
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

            {marker.label && marker.shape !== 'cone' && (
                <div
                    className="absolute px-2 py-1 bg-black/70 text-white text-xs rounded pointer-events-none"
                    style={{
                        whiteSpace: 'nowrap',
                        top: `${adjustedSizeInPixels}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
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
