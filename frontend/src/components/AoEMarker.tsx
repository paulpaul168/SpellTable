import React, { useState, useRef, useEffect } from 'react';
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

    // Convert size in feet to pixels based on grid size
    const sizeInPixels = (marker.sizeInFeet * gridSize) / 5; // Assuming 5ft per grid cell

    useEffect(() => {
        setCurrentPos(marker.position);
    }, [marker.position]);

    // Throttle updates to avoid excessive network traffic
    const throttledUpdate = (newMarker: AoEMarkerType) => {
        const now = performance.now();
        if (now - lastUpdateRef.current >= 32) { // ~30fps
            onUpdate(newMarker);
            lastUpdateRef.current = now;
            pendingUpdateRef.current = null;
        } else {
            pendingUpdateRef.current = newMarker;
        }
    };

    // Process any pending updates
    useEffect(() => {
        if (!pendingUpdateRef.current) return;

        const processPendingUpdate = () => {
            if (pendingUpdateRef.current) {
                onUpdate(pendingUpdateRef.current);
                pendingUpdateRef.current = null;
            }
        };

        const interval = setInterval(processPendingUpdate, 32);
        return () => clearInterval(interval);
    }, [onUpdate]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || !isAdmin) return;
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(true);

        // Calculate the offset between mouse and marker position
        dragOffsetRef.current = {
            x: e.clientX - currentPos.x,
            y: e.clientY - currentPos.y
        };
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();

        const newPosition = {
            x: e.clientX - dragOffsetRef.current.x,
            y: e.clientY - dragOffsetRef.current.y
        };

        setCurrentPos(newPosition);
        throttledUpdate({
            ...marker,
            position: newPosition
        });
    };

    const handleMouseUp = () => {
        if (isDragging) {
            // Final position update
            onUpdate({
                ...marker,
                position: currentPos
            });
        }
        setIsDragging(false);
    };

    // Add global event listeners for drag
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

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
            className="absolute select-none flex flex-col items-center"
            style={{
                position: 'absolute',
                left: `${currentPos.x}px`,
                top: `${currentPos.y}px`,
                transform: `rotate(${marker.rotation}deg)`,
                cursor: isActive && isAdmin ? (isDragging ? 'grabbing' : 'grab') : 'default',
                transformOrigin: 'center',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: 100
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