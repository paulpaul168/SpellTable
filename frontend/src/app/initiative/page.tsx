'use client';

import React, { useState, useEffect } from 'react';
import { Scene as SceneType } from '../../types/map';
import { websocketService } from '../../services/websocket';
import { InitiativeViewerPanel } from '../../components/InitiativeViewerPanel';
import { cn } from '@/lib/utils';

const initialScene: SceneType = {
    id: 'default',
    name: 'Default Scene',
    maps: [],
    activeMapId: null,
    gridSettings: {
        showGrid: true,
        gridSize: 50,
        useFixedGrid: true,
        gridCellsX: 18,
        gridCellsY: 32
    },
    initiativeOrder: [],
    showCurrentPlayer: false,
    aoeMarkers: []
};

export default function InitiativePage() {
    const [scene, setScene] = useState<SceneType>(initialScene);
    const [connectionStatus, setConnectionStatus] = useState('connecting');

    useEffect(() => {
        websocketService.connect();

        const unsubscribe = websocketService.addListener((data) => {
            if (data.type === 'scene_update' && data.scene) {
                const updatedScene = {
                    ...data.scene,
                    initiativeOrder: data.scene.initiativeOrder || []
                };
                setScene(updatedScene);
            } else if (data.type === 'connection_status') {
                setConnectionStatus(data.status || 'unknown');
            }
        });

        return () => {
            unsubscribe();
            websocketService.disconnect();
        };
    }, []);

    return (
        <div className="dark relative flex min-h-dvh w-dvw overflow-hidden bg-gameboard">
            <div
                className={cn(
                    'absolute top-4 right-4 z-[1000] glass-panel rounded-full px-3 py-1.5'
                )}
            >
                <div className="flex items-center gap-2">
                    {connectionStatus === 'connected' ? (
                        <>
                            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                            <span className="text-xs font-medium text-primary">
                                Connected
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
                            <span className="text-xs font-medium capitalize text-muted-foreground">
                                {connectionStatus}
                            </span>
                        </>
                    )}
                </div>
            </div>

            <main className="flex min-h-dvh w-full flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
                <div className="w-full max-w-3xl xl:max-w-4xl">
                    <h1 className="mb-6 text-center text-3xl font-semibold tracking-tight text-foreground">
                        Initiative Order
                    </h1>
                    <InitiativeViewerPanel entries={scene.initiativeOrder} />
                </div>
            </main>
        </div>
    );
};
