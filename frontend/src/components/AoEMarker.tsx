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
    gridSettings
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showSizeIndicator, setShowSizeIndicator] = useState(false);
    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<AoEMarkerType | null>(null);
    const dragOffsetRef = useRef<DragOffset>({ startX: 0, startY: 0, startPosition: { x: 0, y: 0 } });
    const mouseDragOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const markerRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef(marker.position);
    const isDraggingRef = useRef(false);
    const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);

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

            // Calculate the position in grid coordinates (floor to snap to grid)
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

        // For display, convert to pixels
        const pixelPos = marker.useGridCoordinates
            ? gridCoordsToPixel(newPosition)
            : newPosition;

        setCurrentPos(pixelPos);
        positionRef.current = pixelPos;

        // Update the marker position
        onUpdate({
            ...marker,
            position: newPosition,
            useGridCoordinates: marker.useGridCoordinates
        });
    }, [marker, cellWidth, cellHeight, onUpdate, gridCoordsToPixel]);

    // Handle mouse up - end dragging
    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (isDraggingRef.current) {
            e.preventDefault();

            // Final position should be snapped to grid
            const gridPos = pixelToGridCoords({ x: e.clientX, y: e.clientY });
            const snappedGridPos = {
                x: Math.floor(gridPos.x),
                y: Math.floor(gridPos.y)
            };

            // Ensure final position is stored in grid coordinates
            onUpdate({
                ...marker,
                position: snappedGridPos,
                useGridCoordinates: true
            });

            setIsDragging(false);
            isDraggingRef.current = false;
            document.body.classList.remove('dragging-aoe');
        }
    }, [marker, onUpdate, pixelToGridCoords]);

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

    // Clean up resize indicator timer on unmount
    useEffect(() => {
        return () => {
            if (resizeTimerRef.current) {
                clearTimeout(resizeTimerRef.current);
            }
        };
    }, []);

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
                    <div
                        style={{
                            width: 0,
                            height: 0,
                            borderLeft: `${adjustedSizeInPixels / 2}px solid transparent`,
                            borderRight: `${adjustedSizeInPixels / 2}px solid transparent`,
                            borderBottom: `${adjustedSizeInPixels}px solid ${marker.color}`,
                            opacity: marker.opacity
                        }}
                    />
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
            className="absolute select-none flex flex-col items-center"
            style={{
                position: 'absolute',
                left: `${currentPos.x}px`,
                top: `${currentPos.y}px`,
                transform: `translate(-50%, -50%) rotate(${marker.rotation}deg)`, // Center the marker at its position
                cursor: isActive && isAdmin ? (isDragging ? 'grabbing' : 'grab') : 'default',
                transformOrigin: 'center',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: isDragging ? 900 : 500, // High z-index to stay above maps but below UI (1000)
                touchAction: 'none' // Disable browser touch actions
            }}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onMouseEnter={() => !isDragging && setIsHovered(true)}
            onMouseLeave={() => !isDragging && setIsHovered(false)}
        >
            {/* Size indicator - shows when resizing */}
            {isAdmin && showSizeIndicator && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-1 px-2 py-1 bg-black/80 text-white text-xs rounded pointer-events-none">
                    {marker.sizeInFeet}′
                </div>
            )}

            {renderShape()}

            {marker.label && (
                <div
                    className="mt-1 px-2 py-1 bg-black/70 text-white text-xs rounded pointer-events-none"
                    style={{ whiteSpace: 'nowrap' }}
                >
                    {marker.label}
                </div>
            )}
        </div>
    );
}; 