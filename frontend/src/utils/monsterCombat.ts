import type { Monster } from '@/types/monster';
import type { TokenFootprint } from '@/utils/tokenFootprint';
import { abilityModifier, emptySpellSlotArray, normalizeSpellSlotArray } from '@/utils/spellSlots';
import { rollDiceExpression, isDiceExpression } from '@/utils/dice';

export function sizeToTokenFootprint(size: string | undefined): TokenFootprint {
    const s = (size || '').toLowerCase().replace(/[_\s-]/g, '');
    if (s === 'large') return 2;
    if (s === 'huge' || s === 'gargantuan') return 3;
    return 1;
}

export function dexInitiativeModifier(monster: Monster): number {
    const dex = monster.ability_scores?.dexterity;
    if (typeof dex !== 'number') return 0;
    return abilityModifier(dex);
}

export function resolveMonsterHP(monster: Monster, preferRoll: boolean): number {
    if (preferRoll && monster.hp.hit_dice && isDiceExpression(monster.hp.hit_dice)) {
        try {
            return rollDiceExpression(monster.hp.hit_dice);
        } catch {
            /* fall through */
        }
    }
    return monster.hp.average || 1;
}

export function snapshotSpellSlots(monster: Monster): number[] {
    if (!monster.spellcasting?.slots) return emptySpellSlotArray();
    return normalizeSpellSlotArray(monster.spellcasting.slots);
}
