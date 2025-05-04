import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapData } from '../types/map';
import { EyeOff } from 'lucide-react';

interface MapProps {
    map: MapData;
    isActive: boolean;
    onUpdate: (updatedMap: MapData) => void;
    isViewerMode: boolean;
    zIndex: number;
    scale?: number;
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

    // Determine grid cell size in pixels
    const useFixedGrid = gridSettings?.useFixedGrid || false;
    const gridCellsX = gridSettings?.gridCellsX || 25;
    const gridCellsY = gridSettings?.gridCellsY || 13;

    // Calculate grid cell size in pixels based on current viewport
    const cellWidth = useFixedGrid ? window.innerWidth / gridCellsX : gridSettings?.gridSize || 50;
    const cellHeight = useFixedGrid ? window.innerHeight / gridCellsY : gridSettings?.gridSize || 50;

    // Use existing positions if not null/undefined, otherwise use default values
    const currentPosition = {
        x: position?.x ?? 0,
        y: position?.y ?? 0
    };

    // Convert pixel coordinates to grid coordinates
    const pixelToGridCoords = useCallback((pixelPos: { x: number, y: number }) => {
        return {
            x: pixelPos.x / cellWidth,
            y: pixelPos.y / cellHeight
        };
    }, [cellWidth, cellHeight]);

    // Convert grid coordinates to pixel position
    const gridCoordsToPixel = useCallback((gridPos: { x: number, y: number }) => {
        // Add 0.5 to place maps at the center of grid cells
        // rather than at grid line intersections
        const cellCenterX = (gridPos.x + 0.5) * cellWidth;
        const cellCenterY = (gridPos.y + 0.5) * cellHeight;
        return { x: cellCenterX, y: cellCenterY };
    }, [cellWidth, cellHeight]);

    // Calculate display position based on storage format
    const getDisplayPosition = useCallback(() => {
        if (map.data.useGridCoordinates) {
            // Convert from grid coordinates to pixels for display
            return gridCoordsToPixel(currentPosition);
        }
        return currentPosition;
    }, [currentPosition, map.data.useGridCoordinates, gridCoordsToPixel]);

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

            // Calculate movement in pixels
            const deltaX = e.movementX / scale;
            const deltaY = e.movementY / scale;

            let newPosition;

            if (map.data.useGridCoordinates) {
                // If already using grid coordinates, update in grid units
                const gridDeltaX = deltaX / cellWidth;
                const gridDeltaY = deltaY / cellHeight;

                newPosition = {
                    x: currentPosition.x + gridDeltaX,
                    y: currentPosition.y + gridDeltaY
                };
            } else {
                // For existing maps using pixel coordinates, convert to grid
                const pixelPos = {
                    x: currentPosition.x + deltaX,
                    y: currentPosition.y + deltaY
                };

                // Convert to grid coordinates
                newPosition = pixelToGridCoords(pixelPos);
            }

            // For snapping to cell centers, we use the floor function here
            // This is different from the previous approach that used rounding
            if (useFixedGrid) {
                newPosition = {
                    x: Math.floor(newPosition.x),
                    y: Math.floor(newPosition.y)
                };
            }

            setPosition(newPosition);

            // Update the map with new position in grid coordinates
            throttledUpdate({
                position: newPosition,
                useGridCoordinates: true
            });
        }
    }, [isDragging, currentPosition, throttledUpdate, scale, cellWidth, cellHeight, pixelToGridCoords, map.data.useGridCoordinates, useFixedGrid]);

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

    // In the render, use the display position to position the map
    const displayPos = getDisplayPosition();

    return (
        <div
            ref={dragRef}
            className={`absolute ${isActive ? 'cursor-grab' : ''} ${isDragging ? 'cursor-grabbing' : ''}`}
            style={{
                position: 'absolute',
                left: `${displayPos.x}px`,
                top: `${displayPos.y}px`,
                transform: `rotate(${rotation}deg) scale(${mapScale * scale})`,
                transformOrigin: 'center',
                zIndex,
                opacity: map.data.isHidden ? 0 : 1,
                pointerEvents: map.data.isHidden ? 'none' : 'auto'
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