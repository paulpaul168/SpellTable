'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Scene as SceneType, InitiativeEntry } from '../../types/map';
import { websocketService } from '../../services/websocket';

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
    // Create refs for the current player element and previous current player ID
    const currentPlayerRef = useRef<HTMLTableRowElement | null>(null);
    const prevCurrentPlayerIdRef = useRef<string | null>(null);

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

    // Effect to scroll to the current player when it changes
    useEffect(() => {
        // Find the current player
        const currentPlayer = scene.initiativeOrder.find(entry => entry.isCurrentTurn);

        // If there's a current player and it's different from the previous one
        if (currentPlayer && currentPlayer.id !== prevCurrentPlayerIdRef.current) {
            // Update the ref with the current player's ID
            prevCurrentPlayerIdRef.current = currentPlayer.id;

            // Scroll to the current player element with a short delay to ensure DOM is updated
            setTimeout(() => {
                if (currentPlayerRef.current) {
                    currentPlayerRef.current.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }, 100);
        }
    }, [scene.initiativeOrder]);

    // Function to set ref for the current player's row
    const assignRef = (el: HTMLTableRowElement | null, isCurrentPlayer: boolean) => {
        if (isCurrentPlayer) {
            currentPlayerRef.current = el;
        }
    };

    return (
        <div className="flex h-screen bg-zinc-950 overflow-hidden" style={{ height: '100vh', width: '100vw', margin: 0, padding: 0 }}>
            <div className="max-w-2xl mx-auto w-full pt-10 px-4">
                <h1 className="text-zinc-100 text-2xl font-bold mb-6">Initiative Order</h1>

                {scene.initiativeOrder.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-zinc-400">No initiative order has been set</p>
                    </div>
                ) : (
                    <div className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 max-h-[70vh] overflow-y-auto">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-zinc-900 z-10">
                                <tr className="border-b border-zinc-800">
                                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Initiative</th>
                                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scene.initiativeOrder
                                    .sort((a, b) => b.initiative - a.initiative)
                                    .map((entry: InitiativeEntry) => (
                                        <tr
                                            key={entry.id}
                                            ref={(el) => assignRef(el, entry.isCurrentTurn)}
                                            className={`border-b border-zinc-800 ${entry.isCurrentTurn ? 'bg-emerald-950/30' : ''}`}
                                        >
                                            <td className="py-3 px-4 text-zinc-100 font-mono">{entry.initiative}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    {entry.isCurrentTurn && (
                                                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    )}
                                                    <span className={`font-medium ${entry.isPlayer ? 'text-zinc-100' : 'text-amber-400'}`}>
                                                        {entry.name}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}

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
            </div>
        </div>
    );
} 