import type { InitiativeEntry, MapPosition } from '@/types/map';
import { gridCoordsToPixel } from '@/utils/aoeCoordinates';
import type { MeasurePoint } from '@/utils/measureDistance';

/** Grid cells per side: 1 = Medium (5×5 ft), 2 = Large (10×10 ft), 3 = Huge (15×15 ft). */
export const TOKEN_FOOTPRINTS = [1, 2, 3] as const;
export type TokenFootprint = (typeof TOKEN_FOOTPRINTS)[number];

export const DEFAULT_TOKEN_FOOTPRINT: TokenFootprint = 1;

export const TOKEN_FOOTPRINT_FEET: Record<TokenFootprint, number> = {
    1: 5,
    2: 10,
    3: 15,
};

export const TOKEN_FOOTPRINT_LABELS: Record<TokenFootprint, string> = {
    1: '5ft',
    2: '10ft',
    3: '15ft',
};

export const TOKEN_FOOTPRINT_DND: Record<TokenFootprint, string> = {
    1: 'Medium',
    2: 'Large',
    3: 'Huge',
};

export function isTokenFootprint(value: number): value is TokenFootprint {
    return value === 1 || value === 2 || value === 3;
}

export function normalizeTokenFootprint(
    entry: InitiativeEntry,
    defaultFootprint: TokenFootprint = DEFAULT_TOKEN_FOOTPRINT
): TokenFootprint {
    if (entry.tokenFootprint !== undefined && isTokenFootprint(entry.tokenFootprint)) {
        return entry.tokenFootprint;
    }
    if (entry.tokenSize !== undefined && isTokenFootprint(entry.tokenSize)) {
        return entry.tokenSize;
    }
    return defaultFootprint;
}

export function cycleTokenFootprint(
    current: TokenFootprint,
    direction: 'up' | 'down'
): TokenFootprint {
    const idx = TOKEN_FOOTPRINTS.indexOf(current);
    if (direction === 'up') {
        return TOKEN_FOOTPRINTS[Math.min(idx + 1, TOKEN_FOOTPRINTS.length - 1)];
    }
    return TOKEN_FOOTPRINTS[Math.max(idx - 1, 0)];
}

export function getGridCellSize(
    containerRect: DOMRect,
    gridCellsX: number,
    gridCellsY: number
): number {
    const cellWidth = containerRect.width / gridCellsX;
    const cellHeight = containerRect.height / gridCellsY;
    return Math.min(cellWidth, cellHeight);
}

/** Token diameter in pixels for a square footprint on the play-area grid. */
export function getTokenDiameterPixels(
    footprint: TokenFootprint,
    containerRect: DOMRect,
    gridCellsX: number,
    gridCellsY: number
): number {
    return footprint * getGridCellSize(containerRect, gridCellsX, gridCellsY);
}

/** Snap token center to grid; odd footprints align to cell centers, even to cell corners. */
export function snapTokenCenterToGrid(
    containerRelativeX: number,
    containerRelativeY: number,
    footprint: TokenFootprint,
    containerRect: DOMRect,
    gridCellsX: number,
    gridCellsY: number
): { centerGx: number; centerGy: number } {
    const cellWidth = containerRect.width / gridCellsX;
    const cellHeight = containerRect.height / gridCellsY;
    const gx = containerRelativeX / cellWidth;
    const gy = containerRelativeY / cellHeight;

    if (footprint % 2 === 1) {
        return {
            centerGx: Math.floor(gx) + 0.5,
            centerGy: Math.floor(gy) + 0.5,
        };
    }
    return {
        centerGx: Math.round(gx),
        centerGy: Math.round(gy),
    };
}

export type TokenPointerPosition = {
    mapPosition: MapPosition;
    displayPixels: { x: number; y: number };
};

export function pointerToTokenPosition(
    containerRelativeX: number,
    containerRelativeY: number,
    footprint: TokenFootprint,
    containerRect: DOMRect,
    gridCellsX: number,
    gridCellsY: number,
    snapToGrid: boolean = true
): TokenPointerPosition {
    if (!snapToGrid) {
        return {
            mapPosition: {
                x: containerRelativeX / containerRect.width,
                y: containerRelativeY / containerRect.height,
                useGridCoordinates: false,
            },
            displayPixels: {
                x: containerRelativeX,
                y: containerRelativeY,
            },
        };
    }

    const cellWidth = containerRect.width / gridCellsX;
    const cellHeight = containerRect.height / gridCellsY;
    const { centerGx, centerGy } = snapTokenCenterToGrid(
        containerRelativeX,
        containerRelativeY,
        footprint,
        containerRect,
        gridCellsX,
        gridCellsY
    );

    return {
        mapPosition: {
            x: centerGx - 0.5,
            y: centerGy - 0.5,
            useGridCoordinates: true,
        },
        displayPixels: {
            x: centerGx * cellWidth,
            y: centerGy * cellHeight,
        },
    };
}

/** Display position for a token on the map (grid or legacy normalized). */
export function tokenMapPositionToDisplayPixels(
    mapPosition: MapPosition,
    containerRect: DOMRect,
    gridCellsX: number,
    gridCellsY: number
): { x: number; y: number } {
    if (mapPosition.useGridCoordinates !== false) {
        return gridCoordsToPixel(
            mapPosition,
            containerRect,
            gridCellsX,
            gridCellsY
        );
    }
    return {
        x: mapPosition.x * containerRect.width,
        y: mapPosition.y * containerRect.height,
    };
}

const MAP_POSITION_EPS = 1e-4;

export function mapPositionsEqual(a: MapPosition, b: MapPosition): boolean {
    const aGrid = a.useGridCoordinates !== false;
    const bGrid = b.useGridCoordinates !== false;
    if (aGrid !== bGrid) {
        return false;
    }
    return (
        Math.abs(a.x - b.x) < MAP_POSITION_EPS &&
        Math.abs(a.y - b.y) < MAP_POSITION_EPS
    );
}

export function mapPositionToMeasurePoint(
    mapPosition: MapPosition,
    containerRect: DOMRect,
    gridCellsX: number,
    gridCellsY: number
): MeasurePoint {
    const px = tokenMapPositionToDisplayPixels(
        mapPosition,
        containerRect,
        gridCellsX,
        gridCellsY
    );
    return {
        x: px.x / containerRect.width,
        y: px.y / containerRect.height,
    };
}

export function displayPixelsToMeasurePoint(
    px: { x: number; y: number },
    containerRect: DOMRect
): MeasurePoint {
    return {
        x: px.x / containerRect.width,
        y: px.y / containerRect.height,
    };
}

export function mapPositionsToMeasurePoints(
    positions: MapPosition[],
    containerRect: DOMRect,
    gridCellsX: number,
    gridCellsY: number
): MeasurePoint[] {
    return positions.map((p) =>
        mapPositionToMeasurePoint(p, containerRect, gridCellsX, gridCellsY)
    );
}
