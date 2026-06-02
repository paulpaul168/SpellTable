export type AoEEffectBlendMode = 'normal' | 'screen' | 'plus-lighter';

/**
 * ball — full circle of fire (zoom + glow)
 * line-fill — tiled along length to cover wall/bolt
 * stretch — single frame spans bounds
 * cone — wave from apex
 * layered — stacked loops
 * orbit — sprites around perimeter
 */
export type AoEEffectFit =
    | 'ball'
    | 'line-fill'
    | 'stretch'
    | 'cone'
    | 'layered'
    | 'orbit';

export interface AoEEffectMeta {
    frameWidth: number;
    frameHeight: number;
    frameCount: number;
    fps: number;
    loop: boolean;
    blendMode?: AoEEffectBlendMode;
    filter?: string;
    fit?: AoEEffectFit;
    orbitCount?: number;
    layers?: number;
    scale?: number;
    /** Center zoom for ball / line tiles */
    zoom?: number;
}
