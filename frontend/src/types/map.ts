export interface MapData {
    name: string;
    folder?: string | null;
    data: {
        position: {
            x: number;
            y: number;
        };
        useGridCoordinates?: boolean;
        useGridScaling?: boolean;
        scale: number;
        rotation: number;
        isHidden: boolean;
    };
}

export interface MapPosition {
    x: number;
    y: number;
    useGridCoordinates?: boolean;
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
    mapPosition?: MapPosition;
    /** Grid footprint (cells per side): 1 = Medium 5ft, 2 = Large 10ft, 3 = Huge 15ft. */
    tokenFootprint?: 1 | 2 | 3;
    /** @deprecated Legacy pixel diameter — use tokenFootprint; values 1–3 treated as footprint. */
    tokenSize?: number;
    /** Grid cell-center stops accumulated during this combatant's current turn. */
    turnMovementPath?: MapPosition[];
}

export interface EncounterHistoryEntry {
    id: string;
    timestamp: number;
    text: string;
}

export interface SceneImage {
    id: string;
    name: string;
    path: string;
}

import type { AoEEffectTheme } from './aoeEffect';

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
    useGridCoordinates?: boolean;
    rotation: number;
    opacity: number;
    label?: string;
    /** Key under /aoe-effects/{id}/ for animated sprite sheet */
    effectId?: string;
    /** When aoeStagedReveal is on: false hides from viewers until triggered. Undefined = already revealed. */
    revealed?: boolean;
}

export interface FogOfWar {
    id: string;
    points: Array<{
        x: number;
        y: number;
    }>;
    useGridCoordinates?: boolean;
    color: string;
    opacity: number;
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
        useFixedGrid?: boolean;
        gridCellsX?: number;
        gridCellsY?: number;
        /** When false, AoE markers use pixel coordinates and move freely (no cell snapping). Default true. */
        aoeSnapToGrid?: boolean;
        /** When false, combatant tokens use free placement (no cell snapping). Default true. */
        tokenSnapToGrid?: boolean;
        /** Visual style for spell AoE animations (synced to viewers). Default pixel. */
        aoeEffectTheme?: AoEEffectTheme;
        /** When true, new AoE markers stay hidden from viewers until admin triggers them. Default false. */
        aoeStagedReveal?: boolean;
        /** When true, maps cannot be moved, scaled, or rotated on the play area. Default false. */
        mapsLocked?: boolean;
        /** Default token grid footprint when entry.tokenFootprint is unset. */
        defaultTokenFootprint?: 1 | 2 | 3;
        /** @deprecated Use defaultTokenFootprint */
        defaultTokenSize?: number;
        /** Distance calculation for measure tool and movement trails. Default dnd. */
        distanceMode?: 'dnd' | 'euclidean';
        /** Diagonal cost rule when distanceMode is dnd. Default tenFeet. */
        dndDiagonalRule?: 'tenFeet' | 'alternating';
        /** When false, movement trail is hidden on viewer screens. Default true. */
        showMovementTrailToPlayers?: boolean;
    };
    initiativeOrder: InitiativeEntry[];
    encounterHistory?: EncounterHistoryEntry[];
    showCurrentPlayer: boolean;
    aoeMarkers?: AoEMarker[];
    fogOfWar?: FogOfWar[];
} 