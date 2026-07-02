import type { InitiativeEntry, MapPosition, Scene } from '@/types/map';
import { getPlayAreaRect } from '@/utils/aoeCoordinates';
import type { MeasurePoint } from '@/utils/measureDistance';
import {
    FEET_PER_CELL,
    getDndDiagonalIndexAfterPath,
    pathLengthFeet,
    segmentLengthFeet,
} from '@/utils/measureDistance';
import {
    DEFAULT_TOKEN_FOOTPRINT,
    getTokenDiameterPixels,
    mapPositionToMeasurePoint,
    mapPositionsEqual,
    mapPositionsToMeasurePoints,
    normalizeTokenFootprint,
} from '@/utils/tokenFootprint';

export function applyTurnChangeToEntries(
    entries: InitiativeEntry[],
    newCurrentId: string
): InitiativeEntry[] {
    return entries.map((entry) => {
        const isCurrent = !entry.isKilled && entry.id === newCurrentId;
        if (isCurrent) {
            return {
                ...entry,
                isCurrentTurn: true,
                turnMovementPath: entry.mapPosition
                    ? [structuredClone(entry.mapPosition)]
                    : undefined,
            };
        }
        return {
            ...entry,
            isCurrentTurn: false,
            turnMovementPath: undefined,
        };
    });
}

export function computeTurnMovementTrail({
    path,
    previewPoint = null,
    gridSettings,
    containerRef,
    entry,
}: {
    path: MapPosition[];
    previewPoint?: MeasurePoint | null;
    gridSettings: Scene['gridSettings'];
    containerRef: HTMLElement | null;
    entry?: InitiativeEntry;
}): {
    measurePoints: MeasurePoint[];
    totalFeet: number;
    tokenRadius: number;
} {
    const rect = getPlayAreaRect(containerRef);
    const gridCellsX = gridSettings.gridCellsX ?? 25;
    const gridCellsY = gridSettings.gridCellsY ?? 13;

    if (path.length === 0) {
        return { measurePoints: [], totalFeet: 0, tokenRadius: 28 };
    }

    const measurePoints = mapPositionsToMeasurePoints(
        path,
        rect,
        gridCellsX,
        gridCellsY
    );

    let totalFeet = pathLengthFeet(measurePoints, gridSettings, rect);
    if (previewPoint && measurePoints.length > 0) {
        const diagonalIndex = getDndDiagonalIndexAfterPath(
            measurePoints,
            gridSettings
        );
        totalFeet += segmentLengthFeet(
            measurePoints[measurePoints.length - 1],
            previewPoint,
            gridSettings,
            rect,
            FEET_PER_CELL,
            diagonalIndex
        );
    }

    let tokenRadius = 28;
    if (entry?.mapPosition) {
        const footprint = normalizeTokenFootprint(
            entry,
            gridSettings.defaultTokenFootprint ?? DEFAULT_TOKEN_FOOTPRINT
        );
        tokenRadius =
            getTokenDiameterPixels(
                footprint,
                rect,
                gridCellsX,
                gridCellsY
            ) / 2;
    }

    return { measurePoints, totalFeet, tokenRadius };
}

/** Live drag preview from the last committed stop to the current map position. */
export function getLiveMovementPreviewPoint(
    path: MapPosition[],
    currentMapPosition: MapPosition | undefined,
    containerRef: HTMLElement | null,
    gridCellsX: number,
    gridCellsY: number
): MeasurePoint | null {
    if (!currentMapPosition || path.length === 0) {
        return null;
    }
    const lastStop = path[path.length - 1];
    if (mapPositionsEqual(lastStop, currentMapPosition)) {
        return null;
    }
    const rect = getPlayAreaRect(containerRef);
    return mapPositionToMeasurePoint(
        currentMapPosition,
        rect,
        gridCellsX,
        gridCellsY
    );
}
