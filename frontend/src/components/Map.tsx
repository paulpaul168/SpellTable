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
    const [rotation, setRotation] = useState(map.data.rotation || 0);
    const [mapScale, setMapScale] = useState(map.data.scale);
    const [currentDisplayPos, setCurrentDisplayPos] = useState({ x: 0, y: 0 });

    // Use refs for tracking state that shouldn't trigger re-renders
    const lastUpdateRef = useRef<number>(0);
    const isDraggingRef = useRef(false);
    const dragRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const mouseDragOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

    // Determine grid cell size in pixels
    const useFixedGrid = gridSettings?.useFixedGrid || false;
    const gridCellsX = gridSettings?.gridCellsX || 25;
    const gridCellsY = gridSettings?.gridCellsY || 13;

    // Calculate grid cell size in pixels based on current viewport
    const cellWidth = useFixedGrid ? window.innerWidth / gridCellsX : gridSettings?.gridSize || 50;
    const cellHeight = useFixedGrid ? window.innerHeight / gridCellsY : gridSettings?.gridSize || 50;

    // Calculate a base grid size for scaling reference
    const baseGridSize = 50; // Standard 50px grid as reference point

    // Calculate the grid scaling factor (how much the current grid differs from base)
    const gridScaleFactor = cellWidth / baseGridSize;

    // Use existing positions if not null/undefined, otherwise use default values
    const currentPosition = {
        x: position?.x ?? 0,
        y: position?.y ?? 0
    };

    // Convert pixel coordinates to grid coordinates (without snapping)
    const pixelToGridCoords = useCallback((pixelPos: { x: number, y: number }) => {
        return {
            x: pixelPos.x / cellWidth,
            y: pixelPos.y / cellHeight
        };
    }, [cellWidth, cellHeight]);

    // Convert grid coordinates to pixel position (without centering in cells)
    const gridCoordsToPixel = useCallback((gridPos: { x: number, y: number }) => {
        // Directly map grid coordinates to pixels - no snapping
        const pixelX = gridPos.x * cellWidth;
        const pixelY = gridPos.y * cellHeight;
        return { x: pixelX, y: pixelY };
    }, [cellWidth, cellHeight]);

    // Calculate display position based on storage format
    const calculateDisplayPosition = useCallback(() => {
        if (map.data.useGridCoordinates) {
            // Convert from grid coordinates to pixels for display
            return gridCoordsToPixel(currentPosition);
        }
        return currentPosition;
    }, [currentPosition, map.data.useGridCoordinates, gridCoordsToPixel]);

    // Calculate the effective map scale, considering grid size
    const getEffectiveScale = useCallback(() => {
        if (map.data.useGridScaling) {
            // If map is set to use grid-relative scaling, apply the grid factor
            return mapScale * gridScaleFactor;
        }
        // Otherwise, use the absolute scale value
        return mapScale;
    }, [mapScale, gridScaleFactor, map.data.useGridScaling]);

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

    // Update display position when position changes or on mount
    useEffect(() => {
        const newDisplayPos = calculateDisplayPosition();
        setCurrentDisplayPos(newDisplayPos);
    }, [calculateDisplayPosition, position, map.data.useGridCoordinates]);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            const newDisplayPos = calculateDisplayPosition();
            setCurrentDisplayPos(newDisplayPos);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [calculateDisplayPosition]);

    // Handle mouse movement for dragging
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;

        e.preventDefault();

        // Get current mouse position
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // Apply the offset to keep the map at the same relative position under the cursor
        const gridPos = pixelToGridCoords({
            x: mouseX - mouseDragOffsetRef.current.x,
            y: mouseY - mouseDragOffsetRef.current.y
        });

        // Update position state with exact non-rounded grid coordinates
        setPosition(gridPos);

        // Update display position immediately for smooth dragging
        const pixelPos = gridCoordsToPixel(gridPos);
        setCurrentDisplayPos(pixelPos);

        // Send grid position updates while dragging
        onUpdate({
            ...map,
            data: {
                ...map.data,
                position: gridPos,
                useGridCoordinates: true
            }
        });
    }, [map, pixelToGridCoords, gridCoordsToPixel, onUpdate]);

    // When mouse is released
    const handleMouseUp = useCallback(() => {
        if (isDraggingRef.current) {
            // Keep exact non-snapped position but ensure it's stored as grid coordinates
            throttledUpdate({
                position,
                useGridCoordinates: true
            });

            isDraggingRef.current = false;
            document.body.style.cursor = 'default';
        }
    }, [position, throttledUpdate]);

    // Handle escape key to cancel dragging
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && isDraggingRef.current) {
            isDraggingRef.current = false;
            document.body.style.cursor = 'default';
        }
    }, []);

    // Add and remove event listeners
    useEffect(() => {
        if (isDraggingRef.current) {
            window.addEventListener('mousemove', handleMouseMove, { capture: true });
            window.addEventListener('mouseup', handleMouseUp, { capture: true });
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.cursor = 'grabbing';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove, { capture: true });
            window.removeEventListener('mouseup', handleMouseUp, { capture: true });
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleMouseMove, handleMouseUp, handleKeyDown]);

    // Start dragging on mouse down
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || isViewerMode) return;

        e.preventDefault();
        e.stopPropagation();

        // Calculate the offset between mouse and current display position
        mouseDragOffsetRef.current = {
            x: e.clientX - currentDisplayPos.x,
            y: e.clientY - currentDisplayPos.y
        };

        isDraggingRef.current = true;
        document.body.style.cursor = 'grabbing';

        // Add event listeners when dragging starts
        window.addEventListener('mousemove', handleMouseMove, { capture: true });
        window.addEventListener('mouseup', handleMouseUp, { capture: true });
        window.addEventListener('keydown', handleKeyDown);
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

            // Calculate new scale value (as a base scale without grid factor)
            const newScale = Math.max(0.1, mapScale + delta);
            setMapScale(newScale);

            // Update with the new scale and flag for grid scaling
            throttledUpdate({
                scale: newScale,
                useGridScaling: true
            });
        }
    };

    // Get the map's URL
    const getMapUrl = () => {
        // Handle folder structure if present
        const folderPrefix = map.folder ? `/${map.folder.replace(/^\//, '')}` : '';
        return `http://localhost:8010/maps/file/${folderPrefix}/${encodeURIComponent(map.name)}`;
    };

    // For rendering, use the calculated display position
    const effectiveScale = getEffectiveScale();

    return (
        <div
            ref={dragRef}
            className={`absolute ${isActive ? 'cursor-grab' : ''} ${isDraggingRef.current ? 'cursor-grabbing' : ''}`}
            style={{
                position: 'absolute',
                left: `${currentDisplayPos.x}px`,
                top: `${currentDisplayPos.y}px`,
                transform: `rotate(${rotation}deg) scale(${effectiveScale * scale})`,
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