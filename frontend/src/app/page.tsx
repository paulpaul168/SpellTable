'use client';

import React from 'react';
import { Scene } from '../components/Scene';
import { Scene as SceneType } from '../types/map';

const initialScene: SceneType = {
    id: 'default',
    name: 'Default Scene',
    maps: [],
    activeMapId: null,
    gridSettings: {
        showGrid: false,
        gridSize: 50
    },
    initiativeOrder: [],
    showCurrentPlayer: true
};

export default function Home() {
    // Use native 1:1 scaling to match viewer
    return <Scene initialScene={initialScene} isAdmin={true} initialDisplayScale={1.0} />;
}