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
            className={`map-container ${isActive ? 'active' : ''}`}
            style={{
                position: 'absolute',
                left: map.data.position.x,
                top: map.data.position.y,
                transform: `scale(${map.data.scale}) rotate(${map.data.rotation}deg)`,
                cursor: isActive ? 'move' : 'default',
                opacity: isActive ? 1 : 0.7
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div className="map-content">
                <img
                    src={`/maps/${map.name}.png`}
                    alt={map.name}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                    }}
                />
                {map.data.showGrid && (
                    <div
                        className="grid-overlay"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                            backgroundSize: `${map.data.gridSize}px ${map.data.gridSize}px`
                        }}
                    />
                )}
            </div>
        </div>
    );
}; 