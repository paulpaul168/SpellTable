export interface MapData {
    name: string;
    folder?: string | null;
    data: {
        position: {
            x: number;
            y: number;
        };
        scale: number;
        rotation: number;
        isHidden: boolean;
    };
}

export interface InitiativeEntry {
    id: string;
    name: string;
    initiative: number;
    isPlayer: boolean;
    isCurrentTurn: boolean;
    hp?: number;
    initialHP?: number;
    isKilled: boolean;
}

export interface SceneImage {
    id: string;
    name: string;
    path: string;
}

export type AoEShape = 'circle' | 'cone' | 'line' | 'square' | 'cube' | 'cylinder';

export interface AoEMarker {
    id: string;
    shape: AoEShape;
    sizeInFeet: number;
    color: string;
    position: {
        x: number;
        y: number;
    };
    rotation: number;
    opacity: number;
    label?: string;
}

export interface Scene {
    id: string;
    name: string;
    folder?: string;
    maps: MapData[];
    activeMapId: string | null;
    gridSettings: {
        showGrid: boolean;
        gridSize: number;
        gridColor?: string;
        gridOpacity?: number;
    };
    initiativeOrder: InitiativeEntry[];
    showCurrentPlayer: boolean;
    aoeMarkers?: AoEMarker[];
} 