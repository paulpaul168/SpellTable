import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapData } from '../types/map';
import { EyeOff } from 'lucide-react';

interface MapProps {
    map: MapData;
    isActive: boolean;
    onUpdate: (updatedMap: MapData) => void;
    isViewerMode: boolean;
    zIndex: number;
}

export const Map: React.FC<MapProps> = ({ map, isActive, onUpdate, isViewerMode, zIndex }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [currentPos, setCurrentPos] = useState(map.data.position);
    const [imageLoaded, setImageLoaded] = useState(false);

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

    useEffect(() => {
        setCurrentPos(map.data.position);
    }, [map.data.position, map.data.rotation, zIndex]);

    // Track mouse position globally
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                mousePositionRef.current = { x: e.clientX, y: e.clientY };
                const newPosition = {
                    x: e.clientX - dragOffsetRef.current.x,
                    y: e.clientY - dragOffsetRef.current.y
                };
                setCurrentPos(newPosition);
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
            x: e.clientX - currentPos.x,
            y: e.clientY - currentPos.y
        };
    };

    const handleMouseUp = () => {
        if (isDragging) {
            // Send final position update when dragging ends
            onUpdate({
                ...map,
                data: {
                    ...map.data,
                    position: currentPos
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
                    left: `${currentPos.x}px`,
                    top: `${currentPos.y}px`,
                    transform: `scale(${map.data.scale}) rotate(${map.data.rotation}deg)`,
                    opacity: 0.5,
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
                        <div className="absolute inset-0 bg-zinc-900/30" />
                        <div className="absolute inset-0" style={{
                            backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 2px, transparent 2px, transparent 4px)`,
                        }} />
                        <EyeOff className="h-12 w-12 text-zinc-400 relative z-10" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`absolute select-none ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{
                position: 'absolute',
                left: `${currentPos.x}px`,
                top: `${currentPos.y}px`,
                transform: `scale(${map.data.scale}) rotate(${map.data.rotation}deg)`,
                cursor: isActive && !isViewerMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
                opacity: isViewerMode ? 1 : 1,
                transformOrigin: 'center',
                touchAction: 'none',
                willChange: 'transform',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: zIndex
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