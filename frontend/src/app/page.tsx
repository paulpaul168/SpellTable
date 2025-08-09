'use client';

import React from 'react';
import { Scene } from '../components/Scene';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { Scene as SceneType } from '../types/map';

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
    showCurrentPlayer: true,
    aoeMarkers: [],
    fogOfWar: []
};

export default function Home() {
    return (
        <ProtectedRoute requireAdmin={true}>
            <Scene initialScene={initialScene} isAdmin={true} initialDisplayScale={1.0} />
        </ProtectedRoute>
    );
}