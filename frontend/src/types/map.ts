export interface MapData {
    name: string;
    data: {
        position: {
            x: number;
            y: number;
        };
        scale: number;
        rotation: number;
        gridSize: number;
        showGrid: boolean;
    };
}

export interface Scene {
    id: string;
    name: string;
    maps: MapData[];
    activeMapId: string | null;
} 