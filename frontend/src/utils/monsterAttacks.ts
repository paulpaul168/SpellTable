import {
    rollD20,
    rollDiceDetailed,
    type D20RollDetail,
    type DiceRollDetail,
} from '@/utils/dice';

export interface ParsedDamagePart {
    /** Average shown in text, if any */
    average?: number;
    expression: string;
    /** Trailing label e.g. "slashing damage" */
    label?: string;
}

export interface ParsedMonsterAttack {
    attackBonus: number | null;
    damageParts: ParsedDamagePart[];
}

export interface MonsterAttackRollResult {
    name: string;
    toHit: D20RollDetail | null;
    damage: Array<DiceRollDetail & { label?: string; doubled?: boolean }>;
    summary: string;
}

const TO_HIT_RE = /([+-]\d+)\s+to hit/i;
// "28 (6d6 + 7) slashing damage" or "14 (4d6) fire damage"
const DAMAGE_PART_RE =
    /(\d+)\s*\(\s*([0-9dD+\-\s]+?)\s*\)\s*([a-zA-Z][a-zA-Z\s]*?)(?=(?:plus|,|;|$|\.))/gi;

export function parseMonsterAttack(description: string): ParsedMonsterAttack | null {
    const text = description || '';
    const hitMatch = text.match(TO_HIT_RE);
    const attackBonus = hitMatch ? parseInt(hitMatch[1], 10) : null;

    const damageParts: ParsedDamagePart[] = [];
    let m: RegExpExecArray | null;
    DAMAGE_PART_RE.lastIndex = 0;
    while ((m = DAMAGE_PART_RE.exec(text)) !== null) {
        const expression = m[2].replace(/\s+/g, '');
        if (!/\d+d\d+/i.test(expression)) continue;
        damageParts.push({
            average: parseInt(m[1], 10),
            expression,
            label: (m[3] || '').trim().replace(/\s+/g, ' ') || undefined,
        });
    }

    if (attackBonus == null && damageParts.length === 0) {
        return null;
    }

    return { attackBonus, damageParts };
}

export function isRollableMonsterAttack(description: string): boolean {
    return parseMonsterAttack(description) != null;
}

export function rollMonsterAttack(
    name: string,
    description: string
): MonsterAttackRollResult | null {
    const parsed = parseMonsterAttack(description);
    if (!parsed) return null;

    const toHit =
        parsed.attackBonus != null ? rollD20(parsed.attackBonus) : null;

    const damage = parsed.damageParts.map((part) => {
        const first = rollDiceDetailed(part.expression);
        if (toHit?.isCritical) {
            // Crit: roll damage dice again and add (5e — modifiers once)
            const extra = rollDiceDetailed(part.expression);
            const diceOnlyExtra = extra.total - extra.modifier;
            return {
                ...first,
                total: first.total + diceOnlyExtra,
                rolls: [...first.rolls, ...extra.rolls],
                label: part.label,
                doubled: true,
            };
        }
        return { ...first, label: part.label };
    });

    const bits: string[] = [];
    if (toHit) {
        const tag = toHit.isCritical ? ' crit' : toHit.isFumble ? ' miss?' : '';
        bits.push(
            `to hit ${toHit.natural}${formatSigned(toHit.modifier)} = ${toHit.total}${tag}`
        );
    }
    for (const d of damage) {
        const diceBit =
            d.rolls.length > 0 ? `[${d.rolls.join('+')}]` : '';
        const modBit =
            d.modifier !== 0 ? formatSigned(d.modifier) : '';
        const critTag = 'doubled' in d && d.doubled ? ' (crit)' : '';
        bits.push(`${d.label || 'damage'} ${diceBit}${modBit} = ${d.total}${critTag}`);
    }

    return {
        name,
        toHit,
        damage,
        summary: bits.join(' · '),
    };
}

function formatSigned(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
}
