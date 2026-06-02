export type AoEEffectBlendMode = 'normal' | 'screen' | 'plus-lighter';

export type AoEEffectTheme = 'pixel' | 'realistic' | 'none';

export const AOE_EFFECT_THEMES: AoEEffectTheme[] = ['pixel', 'realistic', 'none'];

export const DEFAULT_AOE_EFFECT_THEME: AoEEffectTheme = 'pixel';

/**
 * ball — full circle of fire (zoom + glow)
 * line-fill — tiled along length to cover wall/bolt
 * stretch — each frame spans entire bounds
 * cone — wave from apex
 * layered — stacked loops for dense fire
 * orbit — sprites running around the perimeter
 */
export type AoEEffectFit =
    | 'ball'
    | 'line-fill'
    | 'stretch'
    | 'cone'
    | 'layered'
    | 'orbit';

export interface AoEEffectMeta {
    frameWidth?: number;
    frameHeight?: number;
    frameCount?: number;
    fps?: number;
    loop: boolean;
    blendMode?: AoEEffectBlendMode;
    filter?: string;
    fit?: AoEEffectFit;
    orbitCount?: number;
    layers?: number;
    scale?: number;
    zoom?: number;
    /** Realistic theme: primary media file */
    media?: string;
    sourceUrl?: string;
    sourceTitle?: string;
    license?: string;
}
