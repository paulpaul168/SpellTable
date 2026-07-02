'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene as SceneType } from '../../types/map';
import { Map } from '../../components/Map';
import { websocketService } from '../../services/websocket';
import { InitiativeIndicator } from '../../components/InitiativeIndicator';
import { AoEMarker } from '../../components/AoEMarker';
import { FogOfWar } from '../../components/FogOfWar';
import { CombatantToken } from '../../components/CombatantToken';
import { RippleViewer } from '../../components/RippleViewer';
import { NightModeOverlay } from '../../components/NightModeOverlay';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { getPlayAreaRect, migrateAoEMarkers } from '@/utils/aoeCoordinates';
import { useNightMode } from '@/hooks/useNightMode';
import { playAreaLayerZIndex } from '@/utils/playAreaLayers';

function withMigratedAoEMarkers(
    scene: SceneType,
    container: HTMLElement | null
): SceneType {
    const rect = getPlayAreaRect(container);
    return {
        ...scene,
        aoeMarkers: migrateAoEMarkers(scene.aoeMarkers, rect),
    };
}

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
    aoeMarkers: [],
    fogOfWar: []
};

export default function ViewerPage() {
    const { user, logout } = useAuth();
    const [scene, setScene] = useState<SceneType>(initialScene);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [highlightedMarkerId, setHighlightedMarkerId] = useState<string | null>(null);
    const [isViewerBlanked, setIsViewerBlanked] = useState(false);
    const [isViewerRotated, setIsViewerRotated] = useState(false);

    // Use fixed 1.0 scale to match admin view exactly
    const displayScale = 1.0;
    const playAreaRef = useRef<HTMLDivElement>(null);
    const { isDarkMode, brightness } = useNightMode({ broadcast: false });

    const applySceneWithAoEMigration = useCallback(
        (nextScene: SceneType): SceneType =>
            withMigratedAoEMarkers(nextScene, playAreaRef.current),
        []
    );

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
                    aoeMarkers: data.scene.aoeMarkers || [],
                    fogOfWar: data.scene.fogOfWar || []
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

                setScene(applySceneWithAoEMigration(updatedScene));
            } else if (data.type === 'connection_status') {
                setConnectionStatus(data.status || 'unknown');
            } else if (data.type === 'display_scale_update') {
                // Fixed scale, ignoring scale updates from server
            } else if (data.type === 'highlight_marker' && data.markerId) {
                // Handle marker highlight from admin
                const markerId = data.markerId as string;
                setHighlightedMarkerId(markerId);

                // Clear the highlight after a delay
                setTimeout(() => {
                    setHighlightedMarkerId(null);
                }, 2100); // Match the same duration used in admin view
            } else if (data.type === 'blank_viewer') {
                console.log('Viewer received blank_viewer command');
                setIsViewerBlanked(true);
            } else if (data.type === 'unblank_viewer') {
                console.log('Viewer received unblank_viewer command');
                setIsViewerBlanked(false);
            } else if (data.type === 'rotate_viewer') {
                console.log('Viewer received rotate_viewer command');
                setIsViewerRotated(true);
            } else if (data.type === 'unrotate_viewer') {
                console.log('Viewer received unrotate_viewer command');
                setIsViewerRotated(false);
            } else if (data.type === 'test_ping') {
                // console.log('Viewer received test ping from admin:', data);
            } else {
                // console.log('Viewer received unhandled message type:', data.type, data);
            }
        });

        return () => {
            unsubscribe();
            websocketService.disconnect();
        };
    }, []);

    // Debug effect to track isViewerBlanked state changes
    useEffect(() => {
        // console.log('Viewer isViewerBlanked state changed to:', isViewerBlanked);
    }, [isViewerBlanked]);

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

    const handleLogout = () => {
        logout();
    };

    return (
        <ProtectedRoute>
            <>
            <div
                className="dark flex h-dvh w-dvw overflow-hidden bg-gameboard"
                style={{
                    transform: isViewerRotated ? 'rotate(180deg)' : 'none',
                    transformOrigin: 'center center',
                }}
            >
                {/* Main Content */}
                <div
                    ref={playAreaRef}
                    className="flex-1 relative w-full h-full overflow-hidden"
                    style={{
                        height: '100%',
                        width: '100%',
                        margin: 0,
                        padding: 0
                    }}
                >
                    {(!scene.maps || scene.maps.length === 0) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                            <div className="glass-panel flex max-w-sm flex-col items-center gap-3 rounded-xl p-6">
                                <div className="rounded-lg bg-muted/50 p-3">
                                    <div className="h-8 w-8 rounded bg-muted" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-foreground">
                                        Waiting for map...
                                    </h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        The DM will share a map with you shortly
                                    </p>
                                </div>
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

                    <NightModeOverlay
                        enabled={isDarkMode}
                        brightness={brightness}
                        zIndex={playAreaLayerZIndex(scene.maps?.length ?? 0, 'night')}
                    />

                    {/* AoE Markers - View Only - Ensure they're above maps but below UI */}
                    <div style={{ zIndex: playAreaLayerZIndex(scene.maps?.length ?? 0, 'aoe') }}>
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
                                containerRef={playAreaRef}
                            />
                        ))}
                    </div>

                    {/* Fog of War - View Only - Renders as opaque black to hide content */}
                    <div style={{ zIndex: playAreaLayerZIndex(scene.maps?.length ?? 0, 'fog') }}>
                        {scene.fogOfWar && scene.fogOfWar.map((fog) => (
                            <FogOfWar
                                key={fog.id}
                                fogOfWar={fog}
                                gridSize={scene.gridSettings.gridSize}
                                isActive={false} // Not interactive in viewer mode
                                isAdmin={false}  // Not admin in viewer mode
                                isViewerMode={true} // This makes it render as opaque black
                                onUpdate={() => { }} // No-op in viewer mode
                                onDelete={() => { }} // No-op in viewer mode
                                scale={displayScale}
                                gridSettings={scene.gridSettings}
                            />
                        ))}
                    </div>

                    {/* Combatant tokens */}
                    <div
                        className="absolute inset-0 pointer-events-none [&>*]:pointer-events-none"
                        style={{ zIndex: playAreaLayerZIndex(scene.maps?.length ?? 0, 'tokens') }}
                    >
                        {scene.initiativeOrder
                            .filter((e) => e.mapPosition && !e.isKilled)
                            .map((entry) => (
                                <CombatantToken
                                    key={entry.id}
                                    entry={entry}
                                    isAdmin={false}
                                    onUpdate={() => {}}
                                    containerRef={playAreaRef}
                                    gridSettings={scene.gridSettings}
                                    defaultTokenFootprint={scene.gridSettings.defaultTokenFootprint}
                                />
                            ))}
                    </div>

                    {/* Grid Overlay - above maps/markers, below initiative UI */}
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
                                zIndex: playAreaLayerZIndex(scene.maps?.length ?? 0, 'grid'),
                            }}
                        />
                    )}

                    {/* Current / next player — after grid so z-[1000] stacks on top */}
                    <InitiativeIndicator
                        initiativeOrder={scene.initiativeOrder}
                        showCurrentPlayer={scene.showCurrentPlayer}
                    />
                </div>

                {/* Display Scale Indicator */}
                {displayScale !== 1.0 && (
                    <div className="glass-panel absolute bottom-4 right-16 z-50 rounded px-2 py-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span>Scaling: {(displayScale * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                )}

                {/* Navigation Button */}
                <div className="absolute top-4 right-4 z-50">
                    <Button
                        onClick={() => window.location.href = '/viewer/campaigns'}
                        variant="outline"
                        size="sm"
                        className="glass-panel"
                    >
                        Campaign Diary
                    </Button>
                </div>

                {/* Blank Overlay - Hide all content when admin blanks the viewer */}
                {isViewerBlanked && (
                    <div
                        className="absolute inset-0 bg-black z-[9999] flex items-center justify-center"
                        style={{ height: '100vh', width: '100vw' }}
                    >
                        <div className="text-center">
                            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"></div>
                            <p className="text-sm text-muted-foreground">Waiting for presentation to resume...</p>
                        </div>
                    </div>
                )}
            </div>
            <RippleViewer
                hidden={isViewerBlanked}
                gridSettings={scene.gridSettings}
                playAreaRef={playAreaRef}
            />
            </>
        </ProtectedRoute>
    );
} 