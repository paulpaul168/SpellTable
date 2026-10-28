/** Spell slot helpers (index 0 = 1st level … 8 = 9th), matching DnD-Character-Builder. */

export function emptySpellSlotArray(): number[] {
    return Array(9).fill(0);
}

export function normalizeSpellSlotArray(a: unknown): number[] {
    const z = emptySpellSlotArray();
    if (!Array.isArray(a)) return z;
    for (let i = 0; i < 9; i++) {
        const n = a[i];
        z[i] =
            typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
    }
    return z;
}

export function formatSpellSlotSummary(max: number[]): string {
    const parts: string[] = [];
    for (let i = 0; i < 9; i++) {
        if (max[i] > 0) {
            parts.push(`${max[i]}×${i + 1}${ordinalSuffix(i + 1)}`);
        }
    }
    return parts.length ? parts.join(', ') : '—';
}

function ordinalSuffix(n: number): string {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
}

export function abilityModifier(score: number): number {
    return Math.floor(score / 2) - 5;
}

export function formatModifier(mod: number): string {
    return mod >= 0 ? `+${mod}` : `${mod}`;
}
