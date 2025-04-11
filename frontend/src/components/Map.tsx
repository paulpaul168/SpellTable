import React, { useState } from 'react';
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

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive) return;
        setIsDragging(true);
        setStartPos({
            x: e.clientX - map.data.position.x,
            y: e.clientY - map.data.position.y
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !isActive) return;
        onUpdate({
            ...map,
            data: {
                ...map.data,
                position: {
                    x: e.clientX - startPos.x,
                    y: e.clientY - startPos.y
                }
            }
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div
            className={`absolute transition-all duration-200 ${isActive ? 'z-10' : 'z-0'} ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{
                position: 'absolute',
                left: `${map.data.position.x}px`,
                top: `${map.data.position.y}px`,
                transform: `scale(${map.data.scale}) rotate(${map.data.rotation}deg)`,
                cursor: isActive ? 'move' : 'default',
                opacity: isActive ? 1 : 0.7,
                transformOrigin: 'center',
                touchAction: 'none',
                willChange: 'transform'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
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
                        objectFit: 'contain'
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