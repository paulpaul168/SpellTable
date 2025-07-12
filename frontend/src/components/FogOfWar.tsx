import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FogOfWar as FogOfWarType } from '../types/map';

interface FogOfWarProps {
    fogOfWar: FogOfWarType;
    gridSize: number;
    isActive: boolean;
    isAdmin: boolean;
    isViewerMode: boolean;
    onUpdate: (updatedFogOfWar: FogOfWarType) => void;
    onDelete: (fogOfWarId: string) => void;
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
    startPositions: Array<{ x: number; y: number }>;
}

export const FogOfWar: React.FC<FogOfWarProps> = ({
    fogOfWar,
    gridSize,
    isActive,
    isAdmin,
    isViewerMode,
    onUpdate,
    onDelete,
    scale = 1,
    gridSettings,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<FogOfWarType | null>(null);
    const dragOffsetRef = useRef<DragOffset>({ startX: 0, startY: 0, startPositions: [] });
    const mouseDragOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const fogOfWarRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const isEditingPointRef = useRef(false);

    // Determine if using fixed grid and get necessary values
    const useFixedGrid = gridSettings?.useFixedGrid || false;
    const gridCellsX = gridSettings?.gridCellsX || 25;
    const gridCellsY = gridSettings?.gridCellsY || 13;

    // Calculate cell size based on viewport and grid dimensions
    const cellWidth = window.innerWidth / gridCellsX;
    const cellHeight = window.innerHeight / gridCellsY;

    // Converting positions between grid coordinates and screen pixels
    const pixelToGridCoords = useCallback((pixelPos: { x: number, y: number }) => {
        return {
            x: pixelPos.x / cellWidth,
            y: pixelPos.y / cellHeight
        };
    }, [cellWidth, cellHeight]);

    // Convert grid coordinates to pixel position (aligned with grid borders)
    const gridCoordsToPixel = useCallback((gridPos: { x: number, y: number }) => {
        const borderX = gridPos.x * cellWidth;
        const borderY = gridPos.y * cellHeight;
        return { x: borderX, y: borderY };
    }, [cellWidth, cellHeight]);

    // Convert points to pixel positions
    const convertPointsToPixels = useCallback((points: Array<{ x: number; y: number }>) => {
        return points.map(point => {
            if (fogOfWar.useGridCoordinates) {
                return gridCoordsToPixel(point);
            } else if (useFixedGrid) {
                const gridCoords = pixelToGridCoords(point);
                const cellGridCoords = {
                    x: Math.floor(gridCoords.x),
                    y: Math.floor(gridCoords.y)
                };
                return gridCoordsToPixel(cellGridCoords);
            } else {
                return point;
            }
        });
    }, [fogOfWar.useGridCoordinates, useFixedGrid, pixelToGridCoords, gridCoordsToPixel]);

    // Calculate pixel positions for rendering
    const pixelPoints = convertPointsToPixels(fogOfWar.points);

    // Calculate bounding box for positioning
    const boundingBox = pixelPoints.reduce((acc, point) => {
        return {
            minX: Math.min(acc.minX, point.x),
            minY: Math.min(acc.minY, point.y),
            maxX: Math.max(acc.maxX, point.x),
            maxY: Math.max(acc.maxY, point.y)
        };
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    const centerX = (boundingBox.minX + boundingBox.maxX) / 2;
    const centerY = (boundingBox.minY + boundingBox.maxY) / 2;
    const width = boundingBox.maxX - boundingBox.minX;
    const height = boundingBox.maxY - boundingBox.minY;

    // Create SVG path from points
    const createPath = (points: Array<{ x: number; y: number }>) => {
        if (points.length < 3) return '';

        const relativePoints = points.map(point => ({
            x: point.x - boundingBox.minX,
            y: point.y - boundingBox.minY
        }));

        const pathData = relativePoints.map((point, index) => {
            const command = index === 0 ? 'M' : 'L';
            return `${command} ${point.x} ${point.y}`;
        }).join(' ') + ' Z';

        return pathData;
    };

    // Throttle updates
    const throttledUpdate = useCallback((newFogOfWar: FogOfWarType) => {
        const now = performance.now();
        if (now - lastUpdateRef.current >= 32) { // ~30fps
            onUpdate(newFogOfWar);
            lastUpdateRef.current = now;
            pendingUpdateRef.current = null;
        } else {
            pendingUpdateRef.current = newFogOfWar;
            if (!lastUpdateRef.current) {
                requestAnimationFrame(() => {
                    const pendingFogOfWar = pendingUpdateRef.current;
                    if (pendingFogOfWar) {
                        onUpdate(pendingFogOfWar);
                        pendingUpdateRef.current = null;
                    }
                    lastUpdateRef.current = performance.now();
                });
            }
        }
    }, [onUpdate]);

    // Handle mouse movement for dragging entire polygon
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current && !isEditingPointRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        if (isEditingPointRef.current && editingPointIndex !== null) {
            // Edit single point
            let newPosition;

            if (fogOfWar.useGridCoordinates) {
                const rawGridPos = { x: mouseX / cellWidth, y: mouseY / cellHeight };
                newPosition = {
                    x: Math.floor(rawGridPos.x),
                    y: Math.floor(rawGridPos.y)
                };
            } else {
                newPosition = { x: mouseX, y: mouseY };
            }

            const updatedPoints = fogOfWar.points.map((point, index) =>
                index === editingPointIndex ? newPosition : point
            );

            throttledUpdate({
                ...fogOfWar,
                points: updatedPoints,
                useGridCoordinates: true
            });
        } else if (isDraggingRef.current) {
            // Drag entire polygon
            const deltaX = mouseX - dragOffsetRef.current.startX;
            const deltaY = mouseY - dragOffsetRef.current.startY;

            const updatedPoints = dragOffsetRef.current.startPositions.map(startPos => {
                const newPixelPos = {
                    x: startPos.x + deltaX,
                    y: startPos.y + deltaY
                };

                if (fogOfWar.useGridCoordinates) {
                    const rawGridPos = {
                        x: newPixelPos.x / cellWidth,
                        y: newPixelPos.y / cellHeight
                    };
                    return {
                        x: Math.floor(rawGridPos.x),
                        y: Math.floor(rawGridPos.y)
                    };
                } else {
                    return newPixelPos;
                }
            });

            throttledUpdate({
                ...fogOfWar,
                points: updatedPoints,
                useGridCoordinates: true
            });
        }
    }, [fogOfWar, cellWidth, cellHeight, throttledUpdate, editingPointIndex]);

    // Handle mouse up - end dragging
    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (isDraggingRef.current || isEditingPointRef.current) {
            e.preventDefault();
            setIsDragging(false);
            setEditingPointIndex(null);
            isDraggingRef.current = false;
            isEditingPointRef.current = false;
            document.body.classList.remove('dragging-fog');
        }
    }, []);

    // Set up global drag event handling
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
        const handleGlobalMouseUp = (e: MouseEvent) => handleMouseUp(e);
        const handleGlobalEscapeKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && (isDraggingRef.current || isEditingPointRef.current)) {
                setIsDragging(false);
                setEditingPointIndex(null);
                isDraggingRef.current = false;
                isEditingPointRef.current = false;
                document.body.classList.remove('dragging-fog');
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove, { capture: true });
        window.addEventListener('mouseup', handleGlobalMouseUp, { capture: true });
        window.addEventListener('keydown', handleGlobalEscapeKey);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove, { capture: true });
            window.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true });
            window.removeEventListener('keydown', handleGlobalEscapeKey);
            document.body.classList.remove('dragging-fog');
        };
    }, [handleMouseMove, handleMouseUp]);

    // Update isDraggingRef when isDragging changes
    useEffect(() => {
        isDraggingRef.current = isDragging;
        if (isDragging) {
            document.body.classList.add('dragging-fog');
        } else {
            document.body.classList.remove('dragging-fog');
        }
    }, [isDragging]);

    // Handle mouse down on polygon - start dragging (only with Ctrl key)
    const handlePolygonMouseDown = (e: React.MouseEvent) => {
        if (!isActive || !isAdmin) return;

        // Only allow dragging the entire polygon when Ctrl is held
        if (!e.ctrlKey) return;

        e.stopPropagation();
        e.preventDefault();

        // Store start position and all point positions
        dragOffsetRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPositions: pixelPoints.map(p => ({ x: p.x, y: p.y }))
        };

        setIsDragging(true);
        isDraggingRef.current = true;
        document.body.classList.add('dragging-fog');
    };

    // Handle mouse down on point - start editing
    const handlePointMouseDown = (e: React.MouseEvent, pointIndex: number) => {
        if (!isActive || !isAdmin) return;

        e.stopPropagation();
        e.preventDefault();

        setEditingPointIndex(pointIndex);
        isEditingPointRef.current = true;
        document.body.classList.add('dragging-fog');
    };



    // Add point on Shift+left click
    const handleShiftLeftClick = (e: React.MouseEvent) => {
        if (!isAdmin || !e.shiftKey || e.button !== 0) return;

        e.stopPropagation();
        e.preventDefault();

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        let newPoint;
        if (fogOfWar.useGridCoordinates) {
            const rawGridPos = { x: mouseX / cellWidth, y: mouseY / cellHeight };
            newPoint = {
                x: Math.floor(rawGridPos.x),
                y: Math.floor(rawGridPos.y)
            };
        } else {
            newPoint = { x: mouseX, y: mouseY };
        }

        // Find the best position to insert the new point
        let insertIndex = fogOfWar.points.length;
        let minDistance = Infinity;

        for (let i = 0; i < fogOfWar.points.length; i++) {
            const current = pixelPoints[i];
            const next = pixelPoints[(i + 1) % pixelPoints.length];

            // Calculate distance from point to line segment
            const A = mouseX - current.x;
            const B = mouseY - current.y;
            const C = next.x - current.x;
            const D = next.y - current.y;

            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            const param = lenSq !== 0 ? dot / lenSq : -1;

            let xx, yy;
            if (param < 0) {
                xx = current.x;
                yy = current.y;
            } else if (param > 1) {
                xx = next.x;
                yy = next.y;
            } else {
                xx = current.x + param * C;
                yy = current.y + param * D;
            }

            const distance = Math.sqrt((mouseX - xx) * (mouseX - xx) + (mouseY - yy) * (mouseY - yy));
            if (distance < minDistance) {
                minDistance = distance;
                insertIndex = i + 1;
            }
        }

        const updatedPoints = [
            ...fogOfWar.points.slice(0, insertIndex),
            newPoint,
            ...fogOfWar.points.slice(insertIndex)
        ];

        onUpdate({
            ...fogOfWar,
            points: updatedPoints,
            useGridCoordinates: true
        });
    };

    // Remove point on double-click
    const handlePointDoubleClick = (e: React.MouseEvent, pointIndex: number) => {
        if (!isAdmin || fogOfWar.points.length <= 3) return;

        e.stopPropagation();
        e.preventDefault();

        const updatedPoints = fogOfWar.points.filter((_, index) => index !== pointIndex);

        onUpdate({
            ...fogOfWar,
            points: updatedPoints
        });
    };

    if (pixelPoints.length < 3) return null;

    return (
        <div
            ref={fogOfWarRef}
            className="absolute select-none"
            style={{
                position: 'absolute',
                left: `${boundingBox.minX}px`,
                top: `${boundingBox.minY}px`,
                width: `${width}px`,
                height: `${height}px`,
                cursor: isActive && isAdmin ? (isDragging ? 'grabbing' : 'default') : 'default',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: isDragging ? 900 : 600, // Above AoE markers (500-600 range)
                touchAction: 'none'
            }}
            onMouseDown={handlePolygonMouseDown}
            onClick={handleShiftLeftClick}
            onMouseEnter={() => !isDragging && setIsHovered(true)}
            onMouseLeave={() => !isDragging && setIsHovered(false)}
        >
            <svg
                width={width}
                height={height}
                style={{ overflow: 'visible' }}
            >
                {/* Main polygon */}
                <path
                    d={createPath(pixelPoints)}
                    fill={isViewerMode ? '#000000' : fogOfWar.color}
                    fillOpacity={isViewerMode ? 1.0 : fogOfWar.opacity}
                    stroke={isAdmin && isHovered ? '#ffffff' : 'none'}
                    strokeWidth={isAdmin && isHovered ? 2 : 0}
                    strokeOpacity={0.8}
                />

                {/* Edit points - only show for admin */}
                {isAdmin && isActive && pixelPoints.map((point, index) => (
                    <circle
                        key={index}
                        cx={point.x - boundingBox.minX}
                        cy={point.y - boundingBox.minY}
                        r={6}
                        fill={editingPointIndex === index ? '#ff6b6b' : '#ffffff'}
                        stroke="#000000"
                        strokeWidth={2}
                        style={{
                            cursor: 'pointer',
                            opacity: isHovered ? 1 : 0.3
                        }}
                        onMouseDown={(e) => handlePointMouseDown(e, index)}
                        onDoubleClick={(e) => handlePointDoubleClick(e, index)}
                    />
                ))}
            </svg>

            {/* Instructions overlay for admin */}
            {isAdmin && isActive && isHovered && (
                <div className="absolute top-0 left-0 transform -translate-y-full bg-black/80 text-white text-xs rounded px-2 py-1 pointer-events-none whitespace-nowrap">
                    Ctrl+Drag to move • Shift+Left click to add point • Double-click point to remove
                </div>
            )}
        </div>
    );
}; 