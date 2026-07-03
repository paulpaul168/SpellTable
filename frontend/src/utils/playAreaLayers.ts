/** Z-index offsets within the play area (relative to map count). */
export const PLAY_AREA_LAYER = {
    night: 50,
    aoe: 100,
    fog: 150,
    grid: 200,
    /** Above AoE/fog/grid; below token icons. */
    movementTrail: 945,
    /** Above AoE marker max (900 while dragging). */
    tokens: 950,
} as const;

/** Per-token z-index within the tokens layer (relative ordering only). */
export const COMBATANT_TOKEN_Z_INDEX = {
    default: 1,
    highlighted: 5,
    currentTurn: 10,
    dragging: 20,
    currentTurnDragging: 30,
} as const;

export function playAreaLayerZIndex(
    mapCount: number,
    layer: keyof typeof PLAY_AREA_LAYER
): number {
    return (mapCount || 0) + PLAY_AREA_LAYER[layer];
}
