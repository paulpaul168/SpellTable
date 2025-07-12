import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AoEMarker as AoEMarkerType } from '../types/map';

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
    };
    isHighlighted?: boolean;
}

// Define drag offset reference type
interface DragOffset {
    startX: number;
    startY: number;
    startPosition: { x: number; y: number };
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
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showSizeIndicator, setShowSizeIndicator] = useState(false);
    const [highlightAnimation, setHighlightAnimation] = useState(false);
    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<AoEMarkerType | null>(null);
    const dragOffsetRef = useRef<DragOffset>({ startX: 0, startY: 0, startPosition: { x: 0, y: 0 } });
    const mouseDragOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const markerRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef(marker.position);
    const isDraggingRef = useRef(false);
    const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Determine if using fixed grid and get necessary values
    const useFixedGrid = gridSettings?.useFixedGrid || false;
    const gridCellsX = gridSettings?.gridCellsX || 25;
    const gridCellsY = gridSettings?.gridCellsY || 13;

    // Calculate cell size based on viewport and grid dimensions
    const cellWidth = window.innerWidth / gridCellsX;
    const cellHeight = window.innerHeight / gridCellsY;

    // Calculate effective grid size
    const effectiveGridSize = useFixedGrid
        ? Math.min(cellWidth, cellHeight) // Fixed grid: use the smaller dimension to maintain square cells
        : gridSize;

    // Scale for sizing (5ft = 1 grid cell)
    const sizeInPixels = marker.sizeInFeet * effectiveGridSize / 5;
    const adjustedSizeInPixels = sizeInPixels;

    // Watch for highlight prop changes
    useEffect(() => {
        if (isHighlighted) {
            // Start the highlight animation
            setHighlightAnimation(true);

            // Clear any existing timer
            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }

            // Set a timer to end the animation after two full cycles (3.5 seconds)
            highlightTimerRef.current = setTimeout(() => {
                setHighlightAnimation(false);
                highlightTimerRef.current = null;
            }, 3500);
        }
    }, [isHighlighted]);

    // Clean up timers on unmount
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

    // Converting positions between grid coordinates and screen pixels
    // Grid coordinates: where (0,0) is top-left cell, (1,1) is the cell to the right and down, etc.

    // Convert absolute position to grid coordinates
    const pixelToGridCoords = useCallback((pixelPos: { x: number, y: number }) => {
        return {
            x: pixelPos.x / cellWidth,
            y: pixelPos.y / cellHeight
        };
    }, [cellWidth, cellHeight]);

    // Convert grid coordinates to pixel position (centered in grid cell)
    const gridCoordsToPixel = useCallback((gridPos: { x: number, y: number }) => {
        // Add 0.5 to place markers at the center of grid cells
        // rather than at grid line intersections
        const cellCenterX = (gridPos.x + 0.5) * cellWidth;
        const cellCenterY = (gridPos.y + 0.5) * cellHeight;
        return { x: cellCenterX, y: cellCenterY };
    }, [cellWidth, cellHeight]);

    // Position calculation - converts stored position to correct pixel position
    const calculatePosition = useCallback(() => {
        if (marker.useGridCoordinates) {
            // Position is already in grid coordinates, convert to pixels
            // using cell-centered approach
            return gridCoordsToPixel(marker.position);
        } else if (useFixedGrid) {
            // Position is in pixels but we need grid coordinates for consistency
            // Convert existing pixel position to grid coordinates first
            const gridCoords = pixelToGridCoords(marker.position);

            // Floor to get cell index
            const cellGridCoords = {
                x: Math.floor(gridCoords.x),
                y: Math.floor(gridCoords.y)
            };

            // Then convert back to pixels for display with cell centering
            return gridCoordsToPixel(cellGridCoords);
        } else {
            // For non-fixed grid, use absolute position directly
            return marker.position;
        }
    }, [marker.position, marker.useGridCoordinates, useFixedGrid, pixelToGridCoords, gridCoordsToPixel]);

    // Store and track the computed position
    const [currentPos, setCurrentPos] = useState(calculatePosition());

    // Keep position refs updated
    useEffect(() => {
        positionRef.current = currentPos;
    }, [currentPos]);

    // Update position when marker changes or window resizes
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
    }, [marker.position, calculatePosition]);

    // Throttle updates
    const throttledUpdate = useCallback((newMarker: AoEMarkerType) => {
        const now = performance.now();
        if (now - lastUpdateRef.current >= 32) { // ~30fps
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

    // Handle mouse movement - completely rewritten to position under mouse pointer
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        // Get current mouse position
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // Apply the offset to keep the marker at the same relative position under the cursor
        const offsetMouseX = mouseX - mouseDragOffsetRef.current.x;
        const offsetMouseY = mouseY - mouseDragOffsetRef.current.y;

        // Calculate new position with the offset
        let newPosition;

        if (marker.useGridCoordinates) {
            // Convert offset mouse position to grid coordinates
            const rawGridPos = {
                x: offsetMouseX / cellWidth,
                y: offsetMouseY / cellHeight
            };

            // Calculate the position in grid coordinates - snap to grid
            newPosition = {
                x: Math.floor(rawGridPos.x),
                y: Math.floor(rawGridPos.y)
            };
        } else {
            // For non-grid coordinates, use offset mouse position directly
            newPosition = {
                x: offsetMouseX,
                y: offsetMouseY
            };
        }

        // For display, convert to pixels - ensure preview matches final position
        const pixelPos = marker.useGridCoordinates
            ? gridCoordsToPixel(newPosition)
            : newPosition;

        setCurrentPos(pixelPos);
        positionRef.current = pixelPos;

        // Update the marker position
        onUpdate({
            ...marker,
            position: newPosition,
            useGridCoordinates: true // Always use grid coordinates for consistency
        });
    }, [marker, cellWidth, cellHeight, onUpdate, gridCoordsToPixel]);

    // Handle mouse up - end dragging
    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (isDraggingRef.current) {
            e.preventDefault();

            // The marker position was already updated during dragging,
            // so we only need to ensure consistency
            setIsDragging(false);
            isDraggingRef.current = false;
            document.body.classList.remove('dragging-aoe');
        }
    }, [marker, onUpdate]);

    // Set up global drag event handling
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

    // Update isDraggingRef when isDragging changes
    useEffect(() => {
        isDraggingRef.current = isDragging;
        if (isDragging) {
            document.body.classList.add('dragging-aoe');
        } else {
            document.body.classList.remove('dragging-aoe');
        }
    }, [isDragging]);

    // Handle mouse down - start dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || !isAdmin) return;

        e.stopPropagation();
        e.preventDefault();

        // Calculate the offset between mouse and marker center
        mouseDragOffsetRef.current = {
            x: e.clientX - currentPos.x,
            y: e.clientY - currentPos.y
        };

        // Start dragging
        setIsDragging(true);
        isDraggingRef.current = true;
        document.body.classList.add('dragging-aoe');
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!isActive || !isAdmin) return;
        e.stopPropagation();
        e.preventDefault();

        // Show size indicator when resizing
        if (!e.shiftKey) {
            setIsResizing(true);
            setShowSizeIndicator(true);

            // Clear any existing timer
            if (resizeTimerRef.current) {
                clearTimeout(resizeTimerRef.current);
            }

            // Set a timer to hide the size indicator after 1.5 seconds of inactivity
            resizeTimerRef.current = setTimeout(() => {
                setIsResizing(false);
                setShowSizeIndicator(false);
                resizeTimerRef.current = null;
            }, 1500);
        }

        // Use Shift key to rotate, otherwise resize
        if (e.shiftKey) {
            // Rotate marker
            const delta = e.deltaY > 0 ? -5 : 5;
            const newRotation = (marker.rotation + delta) % 360;

            onUpdate({
                ...marker,
                rotation: newRotation
            });
        } else {
            // Resize marker
            const delta = e.deltaY > 0 ? -5 : 5;
            const newSize = Math.max(5, marker.sizeInFeet + delta);

            onUpdate({
                ...marker,
                sizeInFeet: newSize
            });
        }
    };

    // Different rendering based on shape type
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

    // Double click to delete
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
            {/* Highlight ripple animation with correct shape outline */}
            {highlightAnimation && (
                <div key={Date.now()}>
                    {/* First ripple */}
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

                    {/* Second ripple */}
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

                    {/* Third ripple */}
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

            {/* Size indicator - shows when resizing */}
            {isAdmin && showSizeIndicator && (
                <div className={`absolute ${marker.shape === 'cone' ? 'bottom-0 left-0 translate-y-full ml-2' : 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full'} mt-1 px-2 py-1 bg-black/80 text-white text-xs rounded pointer-events-none`}>
                    {marker.sizeInFeet}′
                </div>
            )}

            {/* The shape itself */}
            {renderShape()}

            {/* Label positioned below the shape without affecting centering */}
            {marker.label && marker.shape !== 'cone' && (
                <div
                    className="absolute px-2 py-1 bg-black/70 text-white text-xs rounded pointer-events-none"
                    style={{
                        whiteSpace: 'nowrap',
                        top: `${adjustedSizeInPixels}px`, // Position 50% of the size below the bottom edge
                        left: '50%',
                        transform: 'translateX(-50%)', // Center the label horizontally
                    }}
                >
                    {marker.label}
                </div>
            )}

            {/* Add a style tag for ripple animations */}
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