import React, { useState, useCallback, useEffect } from 'react';
import { MapData } from '../types/map';

interface MapProps {
    map: MapData;
    isActive: boolean;
    onUpdate: (map: MapData) => void;
}

export const Map: React.FC<MapProps> = ({ map, isActive, onUpdate }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [imageLoaded, setImageLoaded] = useState(false);
    const [lastUpdateTime, setLastUpdateTime] = useState(0);
    const [localPosition, setLocalPosition] = useState(map.data.position);

    // Update local position when map prop changes
    useEffect(() => {
        setLocalPosition(map.data.position);
    }, [map.data.position]);

    // Throttle the updates to 60fps (16.67ms between updates)
    const throttledUpdate = useCallback((newMap: MapData) => {
        const now = performance.now();
        if (now - lastUpdateTime >= 16.67) { // 60fps
            onUpdate(newMap);
            setLastUpdateTime(now);
        }
    }, [lastUpdateTime, onUpdate]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive) return;
        e.preventDefault();
        setIsDragging(true);
        setStartPos({
            x: e.clientX - localPosition.x,
            y: e.clientY - localPosition.y
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !isActive) return;
        e.preventDefault();
        const newPosition = {
            x: e.clientX - startPos.x,
            y: e.clientY - startPos.y
        };

        // Update local position immediately for smooth movement
        setLocalPosition(newPosition);

        // Send update through throttled function
        throttledUpdate({
            ...map,
            data: {
                ...map.data,
                position: newPosition
            }
        });
    };

    const handleMouseUp = () => {
        if (isDragging) {
            // Send final position update when dragging ends
            onUpdate({
                ...map,
                data: {
                    ...map.data,
                    position: localPosition
                }
            });
        }
        setIsDragging(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!isActive) return;
        e.preventDefault();

        // Calculate the new scale
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(0.1, Math.min(5, map.data.scale + delta));

        // Update only the scale
        onUpdate({
            ...map,
            data: {
                ...map.data,
                scale: newScale
            }
        });
    };

    return (
        <div
            className={`absolute select-none ${isActive ? 'z-10' : 'z-0'} ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{
                position: 'absolute',
                left: `${localPosition.x}px`,
                top: `${localPosition.y}px`,
                transform: `scale(${map.data.scale}) rotate(${map.data.rotation}deg)`,
                cursor: isActive ? 'move' : 'default',
                opacity: isActive ? 1 : 0.7,
                transformOrigin: 'center',
                touchAction: 'none',
                willChange: 'transform',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                pointerEvents: isActive ? 'auto' : 'none'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            <div className="relative w-full h-full">
                <img
                    src={`http://localhost:8010/maps/file/${map.name}`}
                    alt={map.name}
                    className="block max-w-none"
                    style={{
                        display: 'block',
                        width: 'auto',
                        height: 'auto',
                        maxWidth: 'none',
                        maxHeight: 'none',
                        objectFit: 'contain',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none'
                    }}
                    onLoad={() => setImageLoaded(true)}
                    draggable={false}
                />
                {map.data.showGrid && imageLoaded && (
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                            backgroundSize: `${map.data.gridSize}px ${map.data.gridSize}px`
                        }}
                    />
                )}
            </div>
        </div>
    );
}; 