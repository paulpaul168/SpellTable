import type { AoEEffectMeta, AoEEffectTheme } from '@/types/aoeEffect';
import { DEFAULT_AOE_EFFECT_THEME } from '@/types/aoeEffect';

const metaCache = new Map<string, AoEEffectMeta>();

function cacheKey(theme: AoEEffectTheme, effectId: string): string {
    return `${theme}:${effectId}`;
}

export function normalizeAoEEffectTheme(
    theme: string | undefined | null,
): AoEEffectTheme {
    if (theme === 'realistic') {
        return 'realistic';
    }
    if (theme === 'none') {
        return 'none';
    }
    return 'pixel';
}

export function getEffectBasePath(theme: AoEEffectTheme, effectId: string): string {
    return `/aoe-effects/themes/${theme}/${effectId}`;
}

export function getAoEEffectSheetUrl(theme: AoEEffectTheme, effectId: string): string {
    return `${getEffectBasePath(theme, effectId)}/sheet.png`;
}

export function getAoEEffectMediaUrl(
    theme: AoEEffectTheme,
    effectId: string,
    media: string,
): string {
    return `${getEffectBasePath(theme, effectId)}/${media}`;
}

async function fetchMeta(url: string): Promise<AoEEffectMeta | null> {
    const res = await fetch(url);
    if (!res.ok) {
        return null;
    }
    return (await res.json()) as AoEEffectMeta;
}

export async function loadAoEEffectMeta(
    effectId: string,
    theme: AoEEffectTheme = DEFAULT_AOE_EFFECT_THEME,
): Promise<AoEEffectMeta | null> {
    const key = cacheKey(theme, effectId);
    const cached = metaCache.get(key);
    if (cached) {
        return cached;
    }

    const themedUrl = `${getEffectBasePath(theme, effectId)}/meta.json`;

    try {
        let meta = await fetchMeta(themedUrl);

        if (!meta && theme === 'pixel') {
            meta = await fetchMeta(`/aoe-effects/${effectId}/meta.json`);
        }

        if (!meta) {
            return null;
        }

        metaCache.set(key, meta);
        return meta;
    } catch {
        return null;
    }
}

export function prefetchAoEEffectMeta(
    effectId: string,
    theme: AoEEffectTheme = DEFAULT_AOE_EFFECT_THEME,
): void {
    void loadAoEEffectMeta(effectId, theme);
}

export function isRealisticEffectMeta(meta: AoEEffectMeta): boolean {
    return Boolean(meta.media && meta.media !== 'sheet.png');
}
