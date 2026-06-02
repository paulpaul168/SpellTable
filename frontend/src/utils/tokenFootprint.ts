import type { InitiativeEntry } from '@/types/map';

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
