'use client';

import React from 'react';
import { Scene } from '../components/Scene';
import { Scene as SceneType } from '../types/map';

const initialScene: SceneType = {
    id: 'default',
    name: 'Default Scene',
    maps: [],
    activeMapId: null
};

export default function Home() {
    return (
        <div>
            <Scene initialScene={initialScene} />
        </div>
    );
}