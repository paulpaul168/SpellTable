import type { Scene } from '@/types/map';

export const FEET_PER_CELL = 5;

export interface MeasurePoint {
    x: number;
    y: number;
}

export interface GridCellDimensions {
    cellWidth: number;
    cellHeight: number;
}

export function getGridCellDimensions(
    gridSettings: Scene['gridSettings']
): GridCellDimensions {
    const useFixedGrid = gridSettings?.useFixedGrid || false;
    const gridCellsX = gridSettings?.gridCellsX || 25;
    const gridCellsY = gridSettings?.gridCellsY || 13;
    const gridSize = gridSettings?.gridSize || 50;

    if (useFixedGrid) {
        return {
            cellWidth:
                typeof window !== 'undefined'
                    ? window.innerWidth / gridCellsX
                    : gridSize,
            cellHeight:
                typeof window !== 'undefined'
                    ? window.innerHeight / gridCellsY
                    : gridSize,
        };
    }

    return { cellWidth: gridSize, cellHeight: gridSize };
}

export function segmentLengthFeet(
    p1: MeasurePoint,
    p2: MeasurePoint,
    dims: GridCellDimensions,
    feetPerCell = FEET_PER_CELL
): number {
    const dxFt = ((p2.x - p1.x) / dims.cellWidth) * feetPerCell;
    const dyFt = ((p2.y - p1.y) / dims.cellHeight) * feetPerCell;
    return Math.hypot(dxFt, dyFt);
}

export function pathLengthFeet(
    points: MeasurePoint[],
    dims: GridCellDimensions,
    feetPerCell = FEET_PER_CELL
): number {
    if (points.length < 2) {
        return 0;
    }

    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += segmentLengthFeet(points[i - 1], points[i], dims, feetPerCell);
    }
    return total;
}

export function formatMeasureFeet(feet: number): string {
    return `${Math.round(feet)} ft`;
}
