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
    const [currentPos, setCurrentPos] = useState(marker.position);
    const [isHovered, setIsHovered] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showSizeIndicator, setShowSizeIndicator] = useState(false);
    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<AoEMarkerType | null>(null);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const markerRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef(marker.position);
    const isDraggingRef = useRef(false);
    const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Determine if using fixed grid and get necessary values
    const useFixedGrid = gridSettings?.useFixedGrid || false;
    const gridCellsX = gridSettings?.gridCellsX || 25;
    const gridCellsY = gridSettings?.gridCellsY || 13;

    // Calculate effective grid size based on settings
    const effectiveGridSize = useFixedGrid
        ? (window.innerWidth / gridCellsX) // For fixed grid, calculate cell size based on viewport
        : gridSize;

    // Use grid size directly for sizing, so a 5ft AoE takes up one grid cell
    // This calculation ensures 5ft = 1 grid square
    const sizeInPixels = marker.sizeInFeet * effectiveGridSize / 5;

    // Apply scaling adjustment for better grid alignment and visibility
    // This compensates for the grid transform scale while maintaining correct proportions
    const scalingFactor = 1.2; // Increase the size by 20% to make markers more visible
    const adjustedSizeInPixels = sizeInPixels * scalingFactor;

    // Keep the position ref updated with the latest state
    useEffect(() => {
        positionRef.current = currentPos;
    }, [currentPos]);

    // Sync position state when marker position prop changes
    useEffect(() => {
        setCurrentPos(marker.position);
        positionRef.current = marker.position;
    }, [marker.position]);

    // Improved throttle function with better handling
    const throttledUpdate = useCallback((newMarker: AoEMarkerType) => {
        const now = performance.now();
        if (now - lastUpdateRef.current >= 32) { // ~30fps
            onUpdate(newMarker);
            lastUpdateRef.current = now;
            pendingUpdateRef.current = null;
        } else {
            pendingUpdateRef.current = newMarker;
            // Schedule processing if not already scheduled
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

    // Handle mouse movement during drag with improved positioning
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        // Adjust for display scaling
        const adjustedX = useFixedGrid ? e.clientX : e.clientX / scale;
        const adjustedY = useFixedGrid ? e.clientY : e.clientY / scale;

        // Calculate new position using the stored drag offset
        const newPosition = {
            x: adjustedX - dragOffsetRef.current.x,
            y: adjustedY - dragOffsetRef.current.y
        };

        setCurrentPos(newPosition);
        positionRef.current = newPosition;

        // Update using the throttled function
        throttledUpdate({
            ...marker,
            position: newPosition
        });
    }, [marker, throttledUpdate, scale, useFixedGrid]);

    // Handle mouse up - end dragging
    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (isDraggingRef.current) {
            e.preventDefault();

            // Final position update
            onUpdate({
                ...marker,
                position: positionRef.current
            });

            setIsDragging(false);
            isDraggingRef.current = false;
            document.body.classList.remove('dragging-aoe');
        }
    }, [marker, onUpdate]);

    // Set up global drag event handling
    useEffect(() => {
        // These handlers will be active throughout the component's lifecycle
        // but will only do something when isDraggingRef.current is true
        const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
        const handleGlobalMouseUp = (e: MouseEvent) => handleMouseUp(e);
        const handleGlobalEscapeKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDraggingRef.current) {
                setIsDragging(false);
                isDraggingRef.current = false;
                document.body.classList.remove('dragging-aoe');
            }
        };

        // Add global listeners that will be active throughout
        window.addEventListener('mousemove', handleGlobalMouseMove, { capture: true });
        window.addEventListener('mouseup', handleGlobalMouseUp, { capture: true });
        window.addEventListener('keydown', handleGlobalEscapeKey);

        // Cleanup on component unmount
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

    // Improved mouse down handler with better offset calculation
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || !isAdmin) return;

        e.stopPropagation();
        e.preventDefault();

        // Get the marker element
        const rect = markerRef.current?.getBoundingClientRect();
        if (rect) {
            // Calculate the center of the marker
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Adjust for display scaling
            const adjustedX = useFixedGrid ? e.clientX : e.clientX / scale;
            const adjustedY = useFixedGrid ? e.clientY : e.clientY / scale;

            // Calculate offset from cursor to center (not corner)
            // This makes dragging work consistently regardless of rotation
            dragOffsetRef.current = {
                x: adjustedX - currentPos.x,
                y: adjustedY - currentPos.y
            };
        } else {
            // Fallback if we can't get the rect
            dragOffsetRef.current = {
                x: 0,
                y: 0
            };
        }

        setIsDragging(true);
        isDraggingRef.current = true;
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
                zIndex: isDragging ? 1000 : 100, // Increase z-index when dragging
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