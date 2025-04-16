import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AoEMarker as AoEMarkerType } from '../types/map';

interface AoEMarkerProps {
    marker: AoEMarkerType;
    gridSize: number;
    isActive: boolean;
    isAdmin: boolean;
    onUpdate: (updatedMarker: AoEMarkerType) => void;
    onDelete: (markerId: string) => void;
}

export const AoEMarker: React.FC<AoEMarkerProps> = ({
    marker,
    gridSize,
    isActive,
    isAdmin,
    onUpdate,
    onDelete,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [currentPos, setCurrentPos] = useState(marker.position);
    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<AoEMarkerType | null>(null);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const markerRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef(marker.position);

    // Convert size in feet to pixels based on grid size
    const sizeInPixels = (marker.sizeInFeet * gridSize) / 5; // Assuming 5ft per grid cell

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
        if (!isDragging) return;

        e.preventDefault();
        e.stopPropagation();

        // Calculate new position using the stored drag offset
        const newPosition = {
            x: e.clientX - dragOffsetRef.current.x,
            y: e.clientY - dragOffsetRef.current.y
        };

        setCurrentPos(newPosition);

        // Update using the throttled function
        throttledUpdate({
            ...marker,
            position: newPosition
        });
    }, [isDragging, marker, throttledUpdate]);

    // Handle mouse up - end dragging
    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();

            // Final position update
            onUpdate({
                ...marker,
                position: positionRef.current
            });

            setIsDragging(false);
        }
    }, [isDragging, marker, onUpdate]);

    // Add global event listeners for drag with proper cleanup
    useEffect(() => {
        if (isDragging) {
            // Use capture phase to ensure our handlers run first
            window.addEventListener('mousemove', handleMouseMove, true);
            window.addEventListener('mouseup', handleMouseUp, true);

            // Also listen for these events to handle edge cases
            window.addEventListener('mouseleave', handleMouseUp, true);
            window.addEventListener('mouseout', handleMouseUp, true);
            document.body.style.userSelect = 'none'; // Prevent text selection during drag
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove, true);
            window.removeEventListener('mouseup', handleMouseUp, true);
            window.removeEventListener('mouseleave', handleMouseUp, true);
            window.removeEventListener('mouseout', handleMouseUp, true);
            document.body.style.userSelect = ''; // Restore normal selection
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Improved mouse down handler with better offset calculation
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || !isAdmin) return;

        e.stopPropagation();
        e.preventDefault();

        // More precise calculation of drag offset
        const rect = markerRef.current?.getBoundingClientRect();
        if (rect) {
            // Calculate the offset from the click point to the element's top-left corner
            dragOffsetRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        } else {
            // Fallback to direct position offset
            dragOffsetRef.current = {
                x: e.clientX - currentPos.x,
                y: e.clientY - currentPos.y
            };
        }

        setIsDragging(true);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!isActive || !isAdmin) return;
        e.stopPropagation();
        e.preventDefault();

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
                            width: `${sizeInPixels}px`,
                            height: `${sizeInPixels}px`,
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
                            borderLeft: `${sizeInPixels / 2}px solid transparent`,
                            borderRight: `${sizeInPixels / 2}px solid transparent`,
                            borderBottom: `${sizeInPixels}px solid ${marker.color}`,
                            opacity: marker.opacity
                        }}
                    />
                );
            case 'line':
                return (
                    <div
                        style={{
                            width: `${sizeInPixels}px`,
                            height: `${gridSize / 2}px`,
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
                            width: `${sizeInPixels}px`,
                            height: `${sizeInPixels}px`,
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
                                width: `${sizeInPixels}px`,
                                height: `${sizeInPixels}px`,
                                backgroundColor: marker.color,
                                opacity: marker.opacity
                            }}
                        />
                        <div
                            className="absolute top-1/4 left-1/4 rounded-full border-2"
                            style={{
                                width: `${sizeInPixels / 2}px`,
                                height: `${sizeInPixels / 2}px`,
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
                transform: `rotate(${marker.rotation}deg)`,
                cursor: isActive && isAdmin ? (isDragging ? 'grabbing' : 'grab') : 'default',
                transformOrigin: 'center',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: 100,
                touchAction: 'none' // Disable browser touch actions
            }}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
        >
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