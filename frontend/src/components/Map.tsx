import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapData, AoEMarker as AoEMarkerType } from '../types/map';
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
    onOpenAoEPalette?: () => void;
}

// Update image source URL to include folder path if available
const getMapImageUrl = (map: MapData) => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
    const baseUrl = `${API_BASE_URL}/maps/file`;

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
    gridSettings,
    onOpenAoEPalette
}) => {
    const [position, setPosition] = useState(map.data.position);
    const [rotation, setRotation] = useState(map.data.rotation || 0);
    const [mapScale, setMapScale] = useState(map.data.scale);
    const [currentDisplayPos, setCurrentDisplayPos] = useState({ x: 0, y: 0 });
    const [highlightedMarkerId, setHighlightedMarkerId] = useState<string | null>(null);

    // Use refs for tracking state that shouldn't trigger re-renders
    const lastUpdateRef = useRef<number>(0);
    const isDraggingRef = useRef(false);
    const dragRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const mouseDragOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const positionRef = useRef(position);

    // Track the map name and folder to detect changes
    const mapNameRef = useRef(map.name);
    const mapFolderRef = useRef(map.folder);
    const lastMapDataStringRef = useRef(JSON.stringify(map.data));

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

    // Update local state when props change (including external updates in viewer mode)
    useEffect(() => {
        // Check if this is a real map change using name and folder
        const isNewMap = map.name !== mapNameRef.current ||
            JSON.stringify(map.folder) !== JSON.stringify(mapFolderRef.current);

        // Also check if map data has changed by comparing serialized versions
        const currentMapDataString = JSON.stringify(map.data);
        const dataChanged = currentMapDataString !== lastMapDataStringRef.current;

        // Update refs for map identification
        mapNameRef.current = map.name;
        mapFolderRef.current = map.folder;
        lastMapDataStringRef.current = currentMapDataString;

        // Only update position if it has changed or it's a new map
        const positionChanged = JSON.stringify(map.data.position) !== JSON.stringify(position);
        if (map.data.position && (isNewMap || positionChanged || dataChanged)) {
            setPosition(map.data.position);
            positionRef.current = map.data.position;
        }

        // Only update rotation if it has changed or it's a new map
        const rotationChanged = map.data.rotation !== rotation;
        if (map.data.rotation !== undefined && (isNewMap || rotationChanged || dataChanged)) {
            setRotation(map.data.rotation);
        }

        // Only update scale if it has changed or it's a new map
        const scaleChanged = map.data.scale !== mapScale;
        if (map.data.scale !== undefined && (isNewMap || scaleChanged || dataChanged)) {
            setMapScale(map.data.scale);
        }
    }, [map, position, rotation, mapScale]);

    // Update position ref when position state changes
    useEffect(() => {
        positionRef.current = position;
    }, [position]);

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
        // Use the current position from the ref to avoid dependency cycles
        const currentPos = positionRef.current;
        if (!currentPos) return { x: 0, y: 0 };

        if (map.data.useGridCoordinates) {
            // Convert from grid coordinates to pixels for display
            return gridCoordsToPixel(currentPos);
        }
        return currentPos;
    }, [map.data.useGridCoordinates, gridCoordsToPixel]);

    // Calculate the effective map scale, considering grid size
    const getEffectiveScale = useCallback(() => {
        if (map.data.useGridScaling) {
            // If map is set to use grid-relative scaling, apply the grid factor
            return mapScale * gridScaleFactor;
        }
        // Otherwise, use the absolute scale value
        return mapScale;
    }, [mapScale, gridScaleFactor, map.data.useGridScaling]);

    // Make sure image is consistently positioned in both admin and viewer modes
    // Use the same positioning logic regardless of mode
    const getImageStyle = useCallback(() => {
        const effectiveScale = getEffectiveScale() * (scale || 1);
        return {
            position: 'absolute',
            left: `${currentDisplayPos.x}px`,
            top: `${currentDisplayPos.y}px`,
            transform: `rotate(${rotation}deg) scale(${effectiveScale})`,
            transformOrigin: 'top left', // Use top left as transform origin consistently
            zIndex,
            opacity: map.data.isHidden ? (isViewerMode ? 0 : 0.4) : 1,
            pointerEvents: map.data.isHidden ? (isViewerMode ? 'none' : 'auto') : 'auto'
        } as React.CSSProperties;
    }, [currentDisplayPos, rotation, getEffectiveScale, scale, zIndex, map.data.isHidden, isViewerMode]);

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

    // Update display position whenever relevant data changes
    useEffect(() => {
        const newDisplayPos = calculateDisplayPosition();
        setCurrentDisplayPos(newDisplayPos);
    }, [calculateDisplayPosition, position, map.data.useGridCoordinates]);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            // Only recalculate display position on resize, don't update state that would trigger another render
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
        // Update position ref directly to avoid dependency on position state
        positionRef.current = gridPos;

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
                position: positionRef.current,
                useGridCoordinates: true
            });

            isDraggingRef.current = false;
            document.body.style.cursor = 'default';
        }
    }, [throttledUpdate]);

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
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
        return `${API_BASE_URL}/maps/file/${folderPrefix}/${encodeURIComponent(map.name)}`;
    };



    // Handler for highlighting a marker
    const handleHighlightMarker = useCallback((markerId: string) => {
        setHighlightedMarkerId(markerId);

        // Clear the highlight after a short delay
        setTimeout(() => {
            setHighlightedMarkerId(null);
        }, 2100); // Slightly longer than the animation duration
    }, []);

    // For rendering, use the calculated display position
    const effectiveScale = getEffectiveScale();

    // Handle double click to open AoE palette
    const handleDoubleClick = (e: React.MouseEvent) => {
        if (isViewerMode || !onOpenAoEPalette) return;

        e.preventDefault();
        e.stopPropagation();

        // Use the parent's AoE palette open function
        onOpenAoEPalette();
    };

    return (
        <>
            <div
                ref={dragRef}
                className={`absolute ${isActive ? 'cursor-grab' : ''} ${isDraggingRef.current ? 'cursor-grabbing' : ''}`}
                style={getImageStyle()}
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
                onDoubleClick={handleDoubleClick}
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


        </>
    );
}; 