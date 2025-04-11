import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapData } from '../types/map';
import { EyeOff } from 'lucide-react';

interface MapProps {
    map: MapData;
    isActive: boolean;
    onUpdate: (map: MapData) => void;
    isViewerMode: boolean;
}

export const Map: React.FC<MapProps> = ({ map, isActive, onUpdate, isViewerMode }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [localPosition, setLocalPosition] = useState(map.data.position);
    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<MapData | null>(null);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const throttledUpdate = useCallback((newMap: MapData) => {
        const now = performance.now();
        if (now - lastUpdateRef.current >= 32) { // 30fps
            onUpdate(newMap);
            lastUpdateRef.current = now;
            pendingUpdateRef.current = null;
        } else {
            pendingUpdateRef.current = newMap;
        }
    }, [onUpdate]);

    // Update local position when map prop changes
    useEffect(() => {
        setLocalPosition(map.data.position);
    }, [map.data.position]);

    // Track mouse position globally
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                mousePositionRef.current = { x: e.clientX, y: e.clientY };
                const newPosition = {
                    x: e.clientX - dragOffsetRef.current.x,
                    y: e.clientY - dragOffsetRef.current.y
                };
                setLocalPosition(newPosition);
                throttledUpdate({
                    ...map,
                    data: {
                        ...map.data,
                        position: newPosition
                    }
                });
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, map, throttledUpdate]);

    // Process any pending updates
    useEffect(() => {
        if (!pendingUpdateRef.current) return;

        const processPendingUpdate = () => {
            if (pendingUpdateRef.current) {
                throttledUpdate(pendingUpdateRef.current);
            }
        };

        const interval = setInterval(processPendingUpdate, 32); // 30fps
        return () => clearInterval(interval);
    }, [throttledUpdate]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || isViewerMode) return;
        e.preventDefault();
        setIsDragging(true);

        // Calculate the offset between mouse and image position
        dragOffsetRef.current = {
            x: e.clientX - localPosition.x,
            y: e.clientY - localPosition.y
        };
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
            pendingUpdateRef.current = null;
        }
        setIsDragging(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!isActive || isViewerMode) return;
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

    if (map.data.isHidden) {
        if (isViewerMode) return null;
        return (
            <div
                className="absolute select-none"
                style={{
                    position: 'absolute',
                    left: `${localPosition.x}px`,
                    top: `${localPosition.y}px`,
                    transform: `scale(${map.data.scale}) rotate(${map.data.rotation}deg)`,
                    opacity: 0.3,
                    transformOrigin: 'center',
                    pointerEvents: isViewerMode ? 'none' : 'auto'
                }}
                onMouseDown={handleMouseDown}
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
                    <div className="absolute inset-0 flex items-center justify-center">
                        <EyeOff className="h-12 w-12 text-zinc-400" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`absolute select-none ${isActive ? 'z-10' : 'z-0'} ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{
                position: 'absolute',
                left: `${localPosition.x}px`,
                top: `${localPosition.y}px`,
                transform: `scale(${map.data.scale}) rotate(${map.data.rotation}deg)`,
                cursor: isActive && !isViewerMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
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
            </div>
        </div>
    );
}; 