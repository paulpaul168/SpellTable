import type { Scene } from '@/types/map';

export const FEET_PER_CELL = 5;

/** Normalized play-area coordinates in 0–1 range. */
export interface MeasurePoint {
    x: number;
    y: number;
}

export interface GridCellDimensions {
    cellWidth: number;
    cellHeight: number;
}

export function getGridCellDimensions(
    gridSettings: Scene['gridSettings'],
    containerRect?: DOMRect
): GridCellDimensions {
    const useFixedGrid = gridSettings?.useFixedGrid || false;
    const gridCellsX = gridSettings?.gridCellsX || 25;
    const gridCellsY = gridSettings?.gridCellsY || 13;
    const gridSize = gridSettings?.gridSize || 50;

    if (useFixedGrid) {
        const width =
            containerRect?.width ??
            (typeof window !== 'undefined' ? window.innerWidth : gridSize * gridCellsX);
        const height =
            containerRect?.height ??
            (typeof window !== 'undefined' ? window.innerHeight : gridSize * gridCellsY);
        return {
            cellWidth: width / gridCellsX,
            cellHeight: height / gridCellsY,
        };
    }

    return { cellWidth: gridSize, cellHeight: gridSize };
}

export function pointerToMeasurePoint(
    clientX: number,
    clientY: number,
    containerRect: DOMRect
): MeasurePoint {
    return {
        x: (clientX - containerRect.left) / containerRect.width,
        y: (clientY - containerRect.top) / containerRect.height,
    };
}

export function measurePointToContainerPixels(
    point: MeasurePoint,
    containerRect: DOMRect
): { x: number; y: number } {
    return {
        x: point.x * containerRect.width,
        y: point.y * containerRect.height,
    };
}

export function isLegacyMeasurePoint(point: MeasurePoint): boolean {
    return point.x > 1 || point.y > 1;
}

/** Best-effort migration from old viewport-pixel storage. */
export function legacyMeasurePointToNormalized(
    point: MeasurePoint,
    containerRect?: DOMRect
): MeasurePoint {
    if (containerRect) {
        return {
            x: (point.x - containerRect.left) / containerRect.width,
            y: (point.y - containerRect.top) / containerRect.height,
        };
    }
    const width = typeof window !== 'undefined' ? window.innerWidth : 1;
    const height = typeof window !== 'undefined' ? window.innerHeight : 1;
    return {
        x: point.x / width,
        y: point.y / height,
    };
}

export function migrateMeasurePoints(
    points: MeasurePoint[],
    containerRect?: DOMRect
): MeasurePoint[] {
    if (points.length === 0 || !isLegacyMeasurePoint(points[0])) {
        return points;
    }
    return points.map((p) => legacyMeasurePointToNormalized(p, containerRect));
}

export function segmentLengthFeet(
    p1: MeasurePoint,
    p2: MeasurePoint,
    gridSettings: Scene['gridSettings'],
    containerRect?: DOMRect,
    feetPerCell = FEET_PER_CELL
): number {
    const dims = getGridCellDimensions(gridSettings, containerRect);
    const width =
        containerRect?.width ??
        (typeof window !== 'undefined' ? window.innerWidth : dims.cellWidth);
    const height =
        containerRect?.height ??
        (typeof window !== 'undefined' ? window.innerHeight : dims.cellHeight);
    const dxFt = ((p2.x - p1.x) * width / dims.cellWidth) * feetPerCell;
    const dyFt = ((p2.y - p1.y) * height / dims.cellHeight) * feetPerCell;
    return Math.hypot(dxFt, dyFt);
}

export function pathLengthFeet(
    points: MeasurePoint[],
    gridSettings: Scene['gridSettings'],
    containerRect?: DOMRect,
    feetPerCell = FEET_PER_CELL
): number {
    if (points.length < 2) {
        return 0;
    }

    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += segmentLengthFeet(
            points[i - 1],
            points[i],
            gridSettings,
            containerRect,
            feetPerCell
        );
    }
    return total;
}

export function formatMeasureFeet(feet: number): string {
    return `${Math.round(feet)} ft`;
}
