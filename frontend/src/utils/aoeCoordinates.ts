import { AoEMarker } from '@/types/map';

export type AoEGridSettings = {
    aoeSnapToGrid?: boolean;
    gridCellsX?: number;
    gridCellsY?: number;
};

export function getPlayAreaRect(container: HTMLElement | null): DOMRect {
    if (container) {
        return container.getBoundingClientRect();
    }
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

export function isGridAoE(
    marker: AoEMarker,
    gridSettings?: AoEGridSettings
): boolean {
    return (
        marker.useGridCoordinates === true &&
        gridSettings?.aoeSnapToGrid !== false
    );
}

export function gridCoordsToPixel(
    gridPos: { x: number; y: number },
    containerRect: DOMRect,
    gridCellsX: number,
    gridCellsY: number
): { x: number; y: number } {
    const cellWidth = containerRect.width / gridCellsX;
    const cellHeight = containerRect.height / gridCellsY;
    return {
        x: (gridPos.x + 0.5) * cellWidth,
        y: (gridPos.y + 0.5) * cellHeight,
    };
}

/** Container-relative pixel position for rendering (marker parent is the play area). */
export function toDisplayPixels(
    marker: AoEMarker,
    gridSettings: AoEGridSettings | undefined,
    containerRect: DOMRect,
    gridCellsX: number,
    gridCellsY: number
): { x: number; y: number } {
    if (isGridAoE(marker, gridSettings)) {
        return gridCoordsToPixel(marker.position, containerRect, gridCellsX, gridCellsY);
    }
    return {
        x: marker.position.x * containerRect.width,
        y: marker.position.y * containerRect.height,
    };
}

export type PointerAoEPosition = {
    position: { x: number; y: number };
    useGridCoordinates: boolean;
    displayPixels: { x: number; y: number };
};

/** Convert container-relative pointer position to stored AoE coordinates. */
export function fromContainerPointer(
    containerRelativeX: number,
    containerRelativeY: number,
    snapToGrid: boolean,
    containerRect: DOMRect,
    gridCellsX: number,
    gridCellsY: number
): PointerAoEPosition {
    const cellWidth = containerRect.width / gridCellsX;
    const cellHeight = containerRect.height / gridCellsY;

    if (snapToGrid) {
        const rawGridPos = {
            x: containerRelativeX / cellWidth,
            y: containerRelativeY / cellHeight,
        };
        const position = {
            x: Math.floor(rawGridPos.x),
            y: Math.floor(rawGridPos.y),
        };
        return {
            position,
            useGridCoordinates: true,
            displayPixels: gridCoordsToPixel(position, containerRect, gridCellsX, gridCellsY),
        };
    }

    const position = {
        x: containerRelativeX / containerRect.width,
        y: containerRelativeY / containerRect.height,
    };
    return {
        position,
        useGridCoordinates: false,
        displayPixels: {
            x: containerRelativeX,
            y: containerRelativeY,
        },
    };
}

/** Legacy grid-less markers stored viewport pixels (values typically > 1). */
export function migrateLegacyPixelMarker(
    marker: AoEMarker,
    _containerRect: DOMRect
): AoEMarker {
    if (marker.useGridCoordinates === true) {
        return marker;
    }
    if (marker.position.x <= 1 && marker.position.y <= 1) {
        return marker;
    }
    // Legacy drag stored viewport clientX/Y — normalize with window so all clients agree.
    return {
        ...marker,
        position: {
            x: marker.position.x / window.innerWidth,
            y: marker.position.y / window.innerHeight,
        },
        useGridCoordinates: false,
    };
}

export function migrateAoEMarkers(
    markers: AoEMarker[] | undefined,
    containerRect: DOMRect
): AoEMarker[] {
    return (markers || []).map((m) => migrateLegacyPixelMarker(m, containerRect));
}

/** Convert AoE markers when toggling snap: grid cell indices ↔ normalized play-area coords. */
export function adaptAoEMarkersSnap(
    markers: AoEMarker[] | undefined,
    enableSnap: boolean,
    gridCellsX: number,
    gridCellsY: number
): AoEMarker[] {
    if (!markers?.length) return markers || [];

    if (enableSnap) {
        return markers.map((m) => {
            if (!m.useGridCoordinates) {
                const isLegacyPixel = m.position.x > 1 || m.position.y > 1;
                if (isLegacyPixel) {
                    const cw = window.innerWidth / gridCellsX;
                    const ch = window.innerHeight / gridCellsY;
                    return {
                        ...m,
                        position: {
                            x: Math.floor(m.position.x / cw),
                            y: Math.floor(m.position.y / ch),
                        },
                        useGridCoordinates: true,
                    };
                }
                return {
                    ...m,
                    position: {
                        x: Math.floor(m.position.x * gridCellsX),
                        y: Math.floor(m.position.y * gridCellsY),
                    },
                    useGridCoordinates: true,
                };
            }
            return {
                ...m,
                position: {
                    x: Math.floor(m.position.x),
                    y: Math.floor(m.position.y),
                },
                useGridCoordinates: true,
            };
        });
    }

    return markers.map((m) => {
        if (m.useGridCoordinates) {
            return {
                ...m,
                position: {
                    x: (m.position.x + 0.5) / gridCellsX,
                    y: (m.position.y + 0.5) / gridCellsY,
                },
                useGridCoordinates: false,
            };
        }
        return m;
    });
}
