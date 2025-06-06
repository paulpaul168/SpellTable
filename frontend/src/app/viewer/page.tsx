'use client';

import React, { useState, useEffect } from 'react';
import { Scene as SceneType } from '../../types/map';
import { Map } from '../../components/Map';
import { websocketService } from '../../services/websocket';
import { InitiativeIndicator } from '../../components/InitiativeIndicator';
import { AoEMarker } from '../../components/AoEMarker';
import { RippleViewer } from '../../components/RippleViewer';

const initialScene: SceneType = {
    id: 'default',
    name: 'Default Scene',
    maps: [],
    activeMapId: null,
    gridSettings: {
        showGrid: true,
        gridSize: 50,
        useFixedGrid: true,
        gridCellsX: 32,
        gridCellsY: 18
    },
    initiativeOrder: [],
    showCurrentPlayer: false,
    aoeMarkers: []
};

export default function ViewerPage() {
    const [scene, setScene] = useState<SceneType>(initialScene);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [highlightedMarkerId, setHighlightedMarkerId] = useState<string | null>(null);

    // Use fixed 1.0 scale to match admin view exactly
    const displayScale = 1.0;

    useEffect(() => {
        websocketService.connect();

        const unsubscribe = websocketService.addListener((data) => {
            if (data.type === 'scene_update' && data.scene) {
                // Make sure we preserve map positioning data exactly as it comes from admin
                const updatedScene = {
                    ...data.scene,
                    initiativeOrder: data.scene.initiativeOrder || [],
                    gridSettings: data.scene.gridSettings || {
                        showGrid: true,
                        gridSize: 50
                    },
                    aoeMarkers: data.scene.aoeMarkers || []
                };

                // Ensure maps have proper position data
                if (updatedScene.maps && updatedScene.maps.length > 0) {
                    updatedScene.maps = updatedScene.maps.map(map => ({
                        ...map,
                        data: {
                            ...map.data,
                            // Ensure position and transform origin are consistent with admin
                            useGridCoordinates: map.data.useGridCoordinates !== undefined ?
                                map.data.useGridCoordinates : true
                        }
                    }));
                }

                setScene(updatedScene);
            } else if (data.type === 'connection_status') {
                setConnectionStatus(data.status || 'unknown');
            } else if (data.type === 'display_scale_update') {
                console.log('Received display scale update:', data.scale);
                // Fixed scale, ignoring scale updates from server
            } else if (data.type === 'highlight_marker' && data.markerId) {
                // Handle marker highlight from admin
                const markerId = data.markerId as string;
                console.log("Received highlight marker:", markerId);
                setHighlightedMarkerId(markerId);

                // Clear the highlight after a delay
                setTimeout(() => {
                    setHighlightedMarkerId(null);
                }, 2100); // Match the same duration used in admin view
            } else if (data.type === 'scene_event') {
                // Handle special visual effects
                console.log('Received scene event:', data);

                // The RippleViewer component will handle these events directly
                // This ensures the viewer page also processes these events
            }
        });

        return () => {
            unsubscribe();
            websocketService.disconnect();
        };
    }, []);

    // Add window resize handler to keep viewer and admin views in sync
    useEffect(() => {
        // Function to handle window resize
        const handleResize = () => {
            // Force a re-render to recalculate grid and positions
            setScene(prevScene => ({ ...prevScene }));

            // Request a fresh scene update from the server
            websocketService.send({
                type: 'request_scene_update'
            });
        };

        // Add resize listener
        window.addEventListener('resize', handleResize);

        // Remove listener on cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const currentPlayer = scene.initiativeOrder?.find(entry => entry.isCurrentTurn);

    return (
        <div className="flex h-screen bg-zinc-950 overflow-hidden" style={{ height: '100vh', width: '100vw', margin: 0, padding: 0 }}>
            {/* Main Content */}
            <div className="flex-1 relative w-full h-full overflow-hidden" style={{ height: '100%', width: '100%', margin: 0, padding: 0 }}>
                {(!scene.maps || scene.maps.length === 0) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="p-4 rounded-xl bg-zinc-900/30">
                            <div className="h-8 w-8 text-zinc-700" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-zinc-300">Waiting for map...</h3>
                            <p className="text-xs text-zinc-600">The DM will share a map with you shortly</p>
                        </div>
                    </div>
                )}
                {/* Maps container - Allow individual z-indices from the admin's sorting order */}
                <div className="absolute inset-0">
                    {scene.maps && scene.maps
                        .filter(map => !map.data.isHidden)
                        .map((map, index) => (
                            <Map
                                key={map.name}
                                map={map}
                                isActive={map.name === scene.activeMapId}
                                onUpdate={() => { }} // No updates in viewer mode
                                isViewerMode={true}
                                zIndex={(scene.maps?.length || 0) - index} // Match admin's z-index calculation
                                scale={displayScale}
                                gridSettings={scene.gridSettings} // Pass grid settings to Map component
                            />
                        ))}
                </div>

                {/* AoE Markers - View Only - Ensure they're above maps but below UI */}
                <div style={{ zIndex: (scene.maps?.length || 0) + 100 }}>
                    {scene.aoeMarkers && scene.aoeMarkers.map((marker) => (
                        <AoEMarker
                            key={marker.id}
                            marker={marker}
                            gridSize={scene.gridSettings.gridSize}
                            isActive={false} // Not interactive in viewer mode
                            isAdmin={false}  // Not admin in viewer mode
                            onUpdate={() => { }} // No-op in viewer mode
                            onDelete={() => { }} // No-op in viewer mode
                            scale={displayScale}
                            gridSettings={scene.gridSettings}
                            isHighlighted={marker.id === highlightedMarkerId}
                        />
                    ))}
                </div>
            </div>

            {/* Current Player Indicator */}
            <InitiativeIndicator
                initiativeOrder={scene.initiativeOrder}
                showCurrentPlayer={scene.showCurrentPlayer}
            />

            {/* Grid Overlay - Always on top of maps and markers but below UI */}
            {scene.gridSettings?.showGrid && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, ${scene.gridSettings.gridColor || 'rgba(255, 255, 255, 0.1)'} 1px, transparent 1px),
                            linear-gradient(to bottom, ${scene.gridSettings.gridColor || 'rgba(255, 255, 255, 0.1)'} 1px, transparent 1px)
                        `,
                        backgroundSize: scene.gridSettings.useFixedGrid
                            ? `calc(100% / ${scene.gridSettings.gridCellsX || 25}) calc(100% / ${scene.gridSettings.gridCellsY || 13})`
                            : `${scene.gridSettings?.gridSize}px ${scene.gridSettings?.gridSize}px`,
                        opacity: scene.gridSettings.gridOpacity || 0.5,
                        zIndex: (scene.maps?.length || 0) + 200,
                    }}
                />
            )}

            <RippleViewer />

            {/* Connection Status */}
            <div className="absolute top-4 right-4 px-2 py-1.5 rounded-md bg-zinc-900/80 backdrop-blur-sm z-[1000]">
                <div className="flex items-center gap-2">
                    {connectionStatus === 'connected' ? (
                        <>
                            <div className="h-3 w-3 rounded-full bg-emerald-500" />
                            <span className="text-[10px] text-emerald-500">Connected</span>
                        </>
                    ) : (
                        <>
                            <div className="h-3 w-3 rounded-full bg-zinc-600" />
                            <span className="text-[10px] text-zinc-600 capitalize">{connectionStatus}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Display Scale Indicator */}
            {displayScale !== 1.0 && (
                <div className="absolute bottom-4 right-16 px-2 py-1 bg-zinc-900/80 backdrop-blur-sm rounded text-xs text-zinc-400 z-50">
                    <div className="flex items-center gap-2">
                        <span>Scaling: {(displayScale * 100).toFixed(1)}%</span>
                    </div>
                </div>
            )}
        </div>
    );
} 