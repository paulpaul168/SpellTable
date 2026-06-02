import type { AoEEffectMeta } from '@/types/aoeEffect';

const metaCache = new Map<string, AoEEffectMeta>();

export function getAoEEffectSheetUrl(effectId: string): string {
    return `/aoe-effects/${effectId}/sheet.png`;
}

export async function loadAoEEffectMeta(effectId: string): Promise<AoEEffectMeta | null> {
    const cached = metaCache.get(effectId);
    if (cached) {
        return cached;
    }

    try {
        const res = await fetch(`/aoe-effects/${effectId}/meta.json`);
        if (!res.ok) {
            return null;
        }
        const meta = (await res.json()) as AoEEffectMeta;
        metaCache.set(effectId, meta);
        return meta;
    } catch {
        return null;
    }
}

export function prefetchAoEEffectMeta(effectId: string): void {
    void loadAoEEffectMeta(effectId);
}
