import React, { useState, useEffect } from 'react';
import { Scene as SceneType, MapData } from '../types/map';
import { Map } from './Map';
import { websocketService } from '../services/websocket';
import { UploadDialog } from './UploadDialog';

interface SceneProps {
    initialScene: SceneType;
}

export const Scene: React.FC<SceneProps> = ({ initialScene }) => {
    const [scene, setScene] = useState<SceneType>(initialScene);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [isUploadOpen, setIsUploadOpen] = useState(false);

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

    const handleUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:8010/maps/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            const newMap: MapData = {
                name: data.filename,
                data: {
                    position: { x: 0, y: 0 },
                    scale: 1,
                    rotation: 0,
                    gridSize: 50,
                    showGrid: true
                }
            };

            const updatedScene = {
                ...scene,
                maps: [...scene.maps, newMap],
                activeMapId: newMap.name
            };

            setScene(updatedScene);
            websocketService.send({
                type: 'scene_update',
                scene: updatedScene
            });
        } catch (error) {
            console.error('Error uploading map:', error);
            // TODO: Add error handling UI
        }
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
                <button
                    onClick={() => setIsUploadOpen(true)}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Upload Map
                </button>
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
                    <button
                        onClick={() => setIsUploadOpen(true)}
                        className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        Upload Your First Map
                    </button>
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

            <UploadDialog
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onUpload={handleUpload}
            />
        </div>
    );
}; 