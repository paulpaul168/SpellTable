export interface MapData {
    name: string;
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
    isKilled: boolean;
}

export interface Scene {
    id: string;
    name: string;
    maps: MapData[];
    activeMapId: string | null;
    gridSettings: {
        showGrid: boolean;
        gridSize: number;
    };
    initiativeOrder: InitiativeEntry[];
    showCurrentPlayer: boolean;
} 