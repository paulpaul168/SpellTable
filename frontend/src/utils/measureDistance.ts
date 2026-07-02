import type { MapPosition, Scene } from '@/types/map';

export const FEET_PER_CELL = 5;

export type DistanceMode = 'dnd' | 'euclidean';
export type DndDiagonalRule = 'tenFeet' | 'alternating';

export function resolveDistanceMode(
    gridSettings?: Scene['gridSettings']
): DistanceMode {
    return gridSettings?.distanceMode === 'euclidean' ? 'euclidean' : 'dnd';
}

export function resolveDndDiagonalRule(
    gridSettings?: Scene['gridSettings']
): DndDiagonalRule {
    return gridSettings?.dndDiagonalRule === 'alternating' ? 'alternating' : 'tenFeet';
}

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

export function measurePointToGridCells(
    point: MeasurePoint,
    gridSettings: Scene['gridSettings']
): { x: number; y: number } {
    const gridCellsX = gridSettings?.gridCellsX ?? 25;
    const gridCellsY = gridSettings?.gridCellsY ?? 13;
    return {
        x: point.x * gridCellsX,
        y: point.y * gridCellsY,
    };
}

function gridCellDelta(
    p1: MeasurePoint,
    p2: MeasurePoint,
    gridSettings: Scene['gridSettings']
): { dx: number; dy: number } {
    const c1 = measurePointToGridCells(p1, gridSettings);
    const c2 = measurePointToGridCells(p2, gridSettings);
    return {
        dx: Math.abs(c2.x - c1.x),
        dy: Math.abs(c2.y - c1.y),
    };
}

function dndGridDeltaFeet(
    dx: number,
    dy: number,
    rule: DndDiagonalRule,
    feetPerCell: number,
    diagonalIndex = 0
): { feet: number; diagonalIndex: number } {
    if (rule === 'tenFeet') {
        return {
            feet: feetPerCell * (dx + dy),
            diagonalIndex,
        };
    }

    const diagonals = Math.min(dx, dy);
    const orth = Math.abs(dx - dy);
    let feet = feetPerCell * orth;
    let nextDiagonalIndex = diagonalIndex;

    for (let i = 0; i < diagonals; i++) {
        nextDiagonalIndex += 1;
        feet += nextDiagonalIndex % 2 === 1 ? feetPerCell : feetPerCell * 2;
    }

    return { feet, diagonalIndex: nextDiagonalIndex };
}

export function dndSegmentLengthFeet(
    p1: MeasurePoint,
    p2: MeasurePoint,
    gridSettings: Scene['gridSettings'],
    rule: DndDiagonalRule = resolveDndDiagonalRule(gridSettings),
    feetPerCell = FEET_PER_CELL,
    diagonalIndex = 0
): { feet: number; diagonalIndex: number } {
    const { dx, dy } = gridCellDelta(p1, p2, gridSettings);
    return dndGridDeltaFeet(dx, dy, rule, feetPerCell, diagonalIndex);
}

export function mapPositionSegmentLengthFeet(
    p1: MapPosition,
    p2: MapPosition,
    gridSettings: Scene['gridSettings'],
    feetPerCell = FEET_PER_CELL,
    diagonalIndex = 0
): { feet: number; diagonalIndex: number } {
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const rule = resolveDndDiagonalRule(gridSettings);
    return dndGridDeltaFeet(dx, dy, rule, feetPerCell, diagonalIndex);
}

function euclideanSegmentLengthFeet(
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

export function getDndDiagonalIndexAfterPath(
    points: MeasurePoint[],
    gridSettings: Scene['gridSettings']
): number {
    if (points.length < 2) {
        return 0;
    }
    if (resolveDistanceMode(gridSettings) !== 'dnd') {
        return 0;
    }
    if (resolveDndDiagonalRule(gridSettings) !== 'alternating') {
        return 0;
    }

    let diagonalIndex = 0;
    for (let i = 1; i < points.length; i++) {
        const result = dndSegmentLengthFeet(
            points[i - 1],
            points[i],
            gridSettings,
            'alternating',
            FEET_PER_CELL,
            diagonalIndex
        );
        diagonalIndex = result.diagonalIndex;
    }
    return diagonalIndex;
}

export function segmentLengthFeet(
    p1: MeasurePoint,
    p2: MeasurePoint,
    gridSettings: Scene['gridSettings'],
    containerRect?: DOMRect,
    feetPerCell = FEET_PER_CELL,
    diagonalIndex = 0
): number {
    if (resolveDistanceMode(gridSettings) === 'dnd') {
        return dndSegmentLengthFeet(
            p1,
            p2,
            gridSettings,
            resolveDndDiagonalRule(gridSettings),
            feetPerCell,
            diagonalIndex
        ).feet;
    }

    return euclideanSegmentLengthFeet(
        p1,
        p2,
        gridSettings,
        containerRect,
        feetPerCell
    );
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

    if (resolveDistanceMode(gridSettings) === 'dnd') {
        const rule = resolveDndDiagonalRule(gridSettings);
        let total = 0;
        let diagonalIndex = 0;

        for (let i = 1; i < points.length; i++) {
            const result = dndSegmentLengthFeet(
                points[i - 1],
                points[i],
                gridSettings,
                rule,
                feetPerCell,
                diagonalIndex
            );
            total += result.feet;
            diagonalIndex = result.diagonalIndex;
        }

        return total;
    }

    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += euclideanSegmentLengthFeet(
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
