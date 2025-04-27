import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapData } from '../types/map';
import { EyeOff } from 'lucide-react';

interface MapProps {
    map: MapData;
    isActive: boolean;
    onUpdate: (updatedMap: MapData) => void;
    isViewerMode: boolean;
    zIndex: number;
    scale?: number; // Add scale prop to adjust for parent container scaling
    gridSettings?: {
        showGrid: boolean;
        gridSize: number;
        useFixedGrid?: boolean;
        gridCellsX?: number;
        gridCellsY?: number;
    };
}

// Update image source URL to include folder path if available
const getMapImageUrl = (map: MapData) => {
    const baseUrl = 'http://localhost:8010/maps/file';

    // Add debugging log
    console.log("Getting map URL for:", map);

    if (map.folder) {
        // Use both folder and filename but make sure to encode them correctly
        // Using a different pattern that might be more reliable with the backend
        const encodedPath = `${encodeURIComponent(map.folder)}/${encodeURIComponent(map.name)}`;
        console.log(`Map in folder encoded path: ${encodedPath}`);

        // Try alternative approach - send folder and filename separately
        const url = `${baseUrl}/${encodedPath}`;
        console.log("Final URL:", url);
        return url;
    }

    console.log(`Map without folder: ${map.name}`);
    const url = `${baseUrl}/${encodeURIComponent(map.name)}`;
    console.log("Final URL:", url);
    return url;
};

export const Map: React.FC<MapProps> = ({
    map,
    isActive,
    onUpdate,
    isViewerMode,
    zIndex,
    scale = 1,
    gridSettings
}) => {
    const [position, setPosition] = useState(map.data.position);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(map.data.rotation || 0);
    const [mapScale, setMapScale] = useState(map.data.scale);
    const lastUpdateRef = useRef<number>(0);
    const dragRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // Determine if using fixed grid and get grid properties
    const useFixedGrid = gridSettings?.useFixedGrid || false;
    const gridCellsX = gridSettings?.gridCellsX || 25;
    const gridCellsY = gridSettings?.gridCellsY || 13;

    // Calculate relative position based on viewport for fixed grid
    const getRelativePosition = useCallback(() => {
        if (useFixedGrid) {
            // For fixed grid, we want to adjust positioning to be relative to viewport cells
            const cellWidth = window.innerWidth / gridCellsX;
            const cellHeight = window.innerHeight / gridCellsY;

            return {
                x: position.x * cellWidth / gridSettings!.gridSize,
                y: position.y * cellHeight / gridSettings!.gridSize
            };
        }
        return position;
    }, [position, useFixedGrid, gridCellsX, gridCellsY, gridSettings]);

    // Use existing positions if not null/undefined, otherwise use default values
    const currentPosition = {
        x: position?.x ?? 0,
        y: position?.y ?? 0
    };

    // Create a throttled update function to reduce number of updates
    const throttledUpdate = useCallback((updateData: Partial<MapData['data']>) => {
        const now = Date.now();
        if (now - lastUpdateRef.current > 50) {  // Throttle to 20 updates per second
            const updatedMap = {
                ...map,
                data: {
                    ...map.data,
                    ...updateData
                }
            };
            onUpdate(updatedMap);
            lastUpdateRef.current = now;
        }
    }, [map, onUpdate]);

    // Update local state when props change
    useEffect(() => {
        if (map.data.position) setPosition(map.data.position);
        if (map.data.rotation !== undefined) setRotation(map.data.rotation);
        if (map.data.scale !== undefined) setMapScale(map.data.scale);
    }, [map.data.position, map.data.rotation, map.data.scale]);

    // Handle mouse movement for dragging
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            e.preventDefault();

            // Calculate new position, accounting for scaling
            const deltaX = e.movementX / scale;
            const deltaY = e.movementY / scale;

            const newPosition = {
                x: currentPosition.x + deltaX,
                y: currentPosition.y + deltaY
            };

            setPosition(newPosition);

            // Update the map with new position
            throttledUpdate({ position: newPosition });
        }
    }, [isDragging, currentPosition, throttledUpdate, scale]);

    // End dragging on mouse up
    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            document.body.style.cursor = 'default';
        }
    }, [isDragging]);

    // Add and remove event listeners
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'grabbing';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Start dragging on mouse down
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || isViewerMode) return;

        e.preventDefault();
        setIsDragging(true);
        setStartPos({ x: e.clientX, y: e.clientY });
    };

    // Handle wheel events for scaling and rotation
    const handleWheel = (e: React.WheelEvent) => {
        if (!isActive || isViewerMode) return;

        e.preventDefault();

        // Hold shift to rotate, otherwise scale
        if (e.shiftKey) {
            const delta = e.deltaY > 0 ? -5 : 5;
            const newRotation = (rotation + delta) % 360;
            setRotation(newRotation);
            throttledUpdate({ rotation: newRotation });
        } else {
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            const newScale = Math.max(0.1, mapScale + delta);
            setMapScale(newScale);
            throttledUpdate({ scale: newScale });
        }
    };

    // Get the map's URL
    const getMapUrl = () => {
        // Handle folder structure if present
        const folderPrefix = map.folder ? `/${map.folder.replace(/^\//, '')}` : '';
        return `http://localhost:8010/maps/file/${folderPrefix}/${encodeURIComponent(map.name)}`;
    };

    return (
        <div
            ref={dragRef}
            className="absolute select-none"
            style={{
                position: 'absolute',
                left: `${currentPosition.x}px`,
                top: `${currentPosition.y}px`,
                transform: `rotate(${rotation}deg) scale(${mapScale})`,
                transformOrigin: 'center center',
                cursor: isActive && !isViewerMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
                zIndex: isActive ? zIndex + 100 : zIndex,
                opacity: map.data.isHidden ? 0.4 : 1, // Show hidden maps as semi-transparent
            }}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
        >
            <img
                ref={imageRef}
                src={getMapUrl()}
                alt={map.name}
                className="max-w-none pointer-events-none"
                style={{ display: 'block' }}
                onDragStart={e => e.preventDefault()}
            />

            {/* Show a visual indicator for hidden maps */}
            {map.data.isHidden && (
                <div className="absolute top-2 right-2 bg-black/60 p-1 rounded-full">
                    <EyeOff className="h-4 w-4 text-white" />
                </div>
            )}
        </div>
    );
}; 