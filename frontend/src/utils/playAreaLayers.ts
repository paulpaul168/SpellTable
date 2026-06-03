/** Z-index offsets within the play area (relative to map count). */
export const PLAY_AREA_LAYER = {
    night: 50,
    aoe: 100,
    fog: 150,
    grid: 200,
    tokens: 210,
} as const;

export function playAreaLayerZIndex(
    mapCount: number,
    layer: keyof typeof PLAY_AREA_LAYER
): number {
    return (mapCount || 0) + PLAY_AREA_LAYER[layer];
}
