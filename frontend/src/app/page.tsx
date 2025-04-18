'use client';

import React, { useState } from 'react';
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
    // Exact ratio for 2K (2560x1440) to 4K (3840x2160)
    const [initialDisplayScale] = useState(0.56);

    return <Scene initialScene={initialScene} isAdmin={true} initialDisplayScale={initialDisplayScale} />;
}