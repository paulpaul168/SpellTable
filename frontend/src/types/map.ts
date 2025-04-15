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

export interface Scene {
    id: string;
    name: string;
    folder?: string;
    maps: MapData[];
    activeMapId: string | null;
    gridSettings: {
        showGrid: boolean;
        gridSize: number;
    };
    initiativeOrder: InitiativeEntry[];
    showCurrentPlayer: boolean;
} 