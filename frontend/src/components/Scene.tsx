import React, { useState, useEffect } from 'react';
import { Scene as SceneType, MapData } from '../types/map';
import { Map } from './Map';
import { websocketService } from '../services/websocket';

interface SceneProps {
    initialScene: SceneType;
}

export const Scene: React.FC<SceneProps> = ({ initialScene }) => {
    const [scene, setScene] = useState<SceneType>(initialScene);
    const [connectionStatus, setConnectionStatus] = useState('connecting');

    useEffect(() => {
        websocketService.connect();

        const unsubscribe = websocketService.addListener((data) => {
            console.log('Received data:', data);
            if (data.type === 'scene_update' && data.scene) {
                setScene(data.scene);
            } else if (data.type === 'connection_status') {
                setConnectionStatus(data.status || 'unknown');
            }
        });

        return () => {
            unsubscribe();
            websocketService.disconnect();
        };
    }, []);

    const handleMapUpdate = (updatedMap: MapData) => {
        const updatedScene = {
            ...scene,
            maps: scene.maps.map(m => m.name === updatedMap.name ? updatedMap : m)
        };
        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
    };

    const handleMapSelect = (mapName: string) => {
        setScene({
            ...scene,
            activeMapId: mapName
        });
    };

    return (
        <div className="scene-container" style={{
            position: 'relative',
            width: '100%',
            height: '100vh',
            backgroundColor: '#f0f0f0',
            padding: '20px'
        }}>
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '10px',
                borderRadius: '5px'
            }}>
                <h2>SpellTable</h2>
                <p>Status: {connectionStatus}</p>
                <p>Maps: {scene.maps.length}</p>
            </div>

            {scene.maps.length === 0 && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center'
                }}>
                    <h3>No maps loaded</h3>
                    <p>Add maps to get started</p>
                </div>
            )}

            {scene.maps.map(map => (
                <Map
                    key={map.name}
                    map={map}
                    isActive={map.name === scene.activeMapId}
                    onUpdate={handleMapUpdate}
                />
            ))}

            <div className="map-list" style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '10px',
                borderRadius: '5px'
            }}>
                <h3>Maps</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {scene.maps.map(map => (
                        <li
                            key={map.name}
                            onClick={() => handleMapSelect(map.name)}
                            style={{
                                cursor: 'pointer',
                                padding: '5px',
                                background: map.name === scene.activeMapId ? '#e0e0e0' : 'transparent'
                            }}
                        >
                            {map.name}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}; 