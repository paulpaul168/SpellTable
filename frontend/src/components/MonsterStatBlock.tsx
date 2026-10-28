'use client';

import React, { useState } from 'react';
import type { Description, Monster, MonsterSpell } from '@/types/monster';
import {
    abilityModifier,
    formatModifier,
    formatSpellSlotSummary,
    normalizeSpellSlotArray,
} from '@/utils/spellSlots';
import {
    isRollableMonsterAttack,
    rollMonsterAttack,
    type MonsterAttackRollResult,
} from '@/utils/monsterAttacks';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type MonsterStatBlockProps = {
    monster: Monster;
    /** Override displayed current HP (combat). */
    currentHP?: number;
    className?: string;
    /** When set, show interactive slot spend/restore. */
    spellSlotsExpended?: number[];
    spellSlotMaximum?: number[];
    innateUsesExpended?: Record<string, number>;
    onSpellSlotChange?: (expended: number[]) => void;
    onInnateUseChange?: (expended: Record<string, number>) => void;
    compact?: boolean;
    /** Click attacks to roll to-hit and damage (default true). */
    interactiveAttacks?: boolean;
};

function speedLine(monster: Monster): string {
    return Object.entries(monster.speed || {})
        .filter(([, value]) => value != null)
        .map(([key, value]) => `${key} ${value} ft.`)
        .join(', ');
}

function ActionLines({
    items,
    interactiveAttacks,
}: {
    items: Description[];
    interactiveAttacks: boolean;
}) {
    const [rolls, setRolls] = useState<Record<string, MonsterAttackRollResult>>({});

    return (
        <div className="space-y-2">
            {items.map((d) => {
                const rollable =
                    interactiveAttacks && isRollableMonsterAttack(d.description);
                const result = rolls[d.title];
                return (
                    <div key={`act-${d.title}`} className="space-y-1">
                        <p>
                            {rollable ? (
                                <button
                                    type="button"
                                    className="font-semibold italic text-amber-200 underline decoration-amber-600/70 underline-offset-2 hover:text-amber-100 hover:decoration-amber-400"
                                    title="Roll attack"
                                    onClick={() => {
                                        const rolled = rollMonsterAttack(
                                            d.title,
                                            d.description
                                        );
                                        if (rolled) {
                                            setRolls((prev) => ({
                                                ...prev,
                                                [d.title]: rolled,
                                            }));
                                        }
                                    }}
                                >
                                    {d.title}.
                                </button>
                            ) : (
                                <span className="font-semibold italic">{d.title}.</span>
                            )}{' '}
                            {d.description}
                        </p>
                        {result && (
                            <div className="rounded border border-amber-700/50 bg-amber-950/40 px-2 py-1 text-xs tabular-nums text-amber-100">
                                <span className="font-semibold">{result.name}:</span>{' '}
                                {result.summary}
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="ml-2 h-5 px-1.5 text-[10px] text-amber-200"
                                    onClick={() => {
                                        const rolled = rollMonsterAttack(
                                            d.title,
                                            d.description
                                        );
                                        if (rolled) {
                                            setRolls((prev) => ({
                                                ...prev,
                                                [d.title]: rolled,
                                            }));
                                        }
                                    }}
                                >
                                    Reroll
                                </Button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function groupSpells(spells: MonsterSpell[] | undefined) {
    const list = spells ?? [];
    const atWill = list.filter((s) => s.usage === 'at_will');
    const perDay = list.filter((s) => s.usage === 'per_day');
    const slotted = list.filter((s) => !s.usage || s.usage === 'slot');
    const byLevel = new Map<number, MonsterSpell[]>();
    for (const s of slotted) {
        const arr = byLevel.get(s.level) ?? [];
        arr.push(s);
        byLevel.set(s.level, arr);
    }
    return { atWill, perDay, byLevel };
}

function SlotPips({
    max,
    expended,
    onChange,
    interactive,
}: {
    max: number[];
    expended: number[];
    onChange?: (next: number[]) => void;
    interactive?: boolean;
}) {
    const rows = max
        .map((m, i) => ({ tier: i + 1, max: m, used: expended[i] ?? 0 }))
        .filter((r) => r.max > 0);
    if (rows.length === 0) return null;

    return (
        <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Spell slots ({formatSpellSlotSummary(max)})
            </p>
            <div className="flex flex-wrap gap-3">
                {rows.map((row) => (
                    <div key={row.tier} className="flex items-center gap-1.5">
                        <span className="w-6 text-xs tabular-nums text-muted-foreground">
                            {row.tier}
                            {row.tier === 1 ? 'st' : row.tier === 2 ? 'nd' : row.tier === 3 ? 'rd' : 'th'}
                        </span>
                        <div className="flex gap-0.5">
                            {Array.from({ length: row.max }, (_, i) => {
                                const filled = i < row.used;
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        disabled={!interactive || !onChange}
                                        title={
                                            filled
                                                ? `Restore ${row.tier}-level slot`
                                                : `Expend ${row.tier}-level slot`
                                        }
                                        className={cn(
                                            'h-3.5 w-3.5 rounded-sm border border-amber-700/60',
                                            filled ? 'bg-amber-900/40' : 'bg-amber-400',
                                            interactive && onChange && 'cursor-pointer hover:ring-1 hover:ring-amber-300'
                                        )}
                                        onClick={() => {
                                            if (!onChange) return;
                                            const next = normalizeSpellSlotArray(expended);
                                            if (filled) {
                                                next[row.tier - 1] = Math.max(0, next[row.tier - 1] - 1);
                                            } else {
                                                next[row.tier - 1] = Math.min(
                                                    row.max,
                                                    next[row.tier - 1] + 1
                                                );
                                            }
                                            onChange(next);
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {interactive && onChange && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onChange(normalizeSpellSlotArray([]))}
                >
                    Reset slots
                </Button>
            )}
        </div>
    );
}

export function MonsterStatBlock({
    monster,
    currentHP,
    className,
    spellSlotsExpended,
    spellSlotMaximum,
    innateUsesExpended,
    onSpellSlotChange,
    onInnateUseChange,
    compact,
    interactiveAttacks = true,
}: MonsterStatBlockProps) {
    const sc = monster.spellcasting;
    const slotMax = normalizeSpellSlotArray(
        spellSlotMaximum ?? sc?.slots ?? []
    );
    const expended = normalizeSpellSlotArray(spellSlotsExpended ?? []);
    const innate = innateUsesExpended ?? {};
    const { atWill, perDay, byLevel } = groupSpells(sc?.spells);
    const interactive = Boolean(onSpellSlotChange || onInnateUseChange);

    return (
        <div
            className={cn(
                'space-y-3 text-sm text-zinc-800 dark:text-zinc-100',
                compact && 'text-xs space-y-2',
                className
            )}
        >
            <div>
                <h3 className="text-lg font-semibold leading-tight">{monster.name}</h3>
                <p className="text-xs capitalize text-muted-foreground">
                    {monster.size}
                    {monster.alignment ? `, ${monster.alignment.replace(/_/g, ' ')}` : ''}
                </p>
            </div>

            <div className="space-y-0.5 border-y border-amber-800/40 py-2">
                <p>
                    <span className="font-semibold">Armor Class</span> {monster.armor.ac}
                    {monster.armor.type
                        ? ` (${monster.armor.type.replace(/_/g, ' ')}${
                              monster.armor.shield ? ', shield' : ''
                          })`
                        : ''}
                </p>
                <p>
                    <span className="font-semibold">Hit Points</span>{' '}
                    {currentHP !== undefined ? currentHP : monster.hp.average}
                    {currentHP !== undefined && monster.hp.average
                        ? ` / ${monster.hp.average}`
                        : ''}{' '}
                    ({monster.hp.hit_dice})
                </p>
                <p>
                    <span className="font-semibold">Speed</span> {speedLine(monster) || '—'}
                </p>
            </div>

            {monster.ability_scores && (
                <div className="grid grid-cols-6 gap-1 text-center">
                    {(
                        [
                            ['STR', monster.ability_scores.strength],
                            ['DEX', monster.ability_scores.dexterity],
                            ['CON', monster.ability_scores.constitution],
                            ['INT', monster.ability_scores.intelligence],
                            ['WIS', monster.ability_scores.wisdom],
                            ['CHA', monster.ability_scores.charisma],
                        ] as const
                    ).map(([label, score]) => (
                        <div
                            key={label}
                            className="rounded border border-zinc-200 px-1 py-1 dark:border-zinc-700"
                        >
                            <div className="text-[10px] font-semibold text-muted-foreground">
                                {label}
                            </div>
                            <div className="tabular-nums font-medium">
                                {score} ({formatModifier(abilityModifier(score))})
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="space-y-0.5">
                {(monster.saving_throws?.length ?? 0) > 0 && (
                    <p>
                        <span className="font-semibold">Saving Throws</span>{' '}
                        {monster.saving_throws
                            ?.map(
                                (st) =>
                                    `${st.saving_throw} ${formatModifier(st.modifier)}`
                            )
                            .join(', ')}
                    </p>
                )}
                {(monster.skills?.length ?? 0) > 0 && (
                    <p>
                        <span className="font-semibold">Skills</span>{' '}
                        {monster.skills
                            ?.map((sk) => `${sk.skill} ${formatModifier(sk.modifier)}`)
                            .join(', ')}
                    </p>
                )}
                {(monster.damage_resistances?.length ?? 0) > 0 && (
                    <p>
                        <span className="font-semibold">Damage Resistances</span>{' '}
                        {monster.damage_resistances?.join(', ')}
                    </p>
                )}
                {(monster.damage_immunities?.length ?? 0) > 0 && (
                    <p>
                        <span className="font-semibold">Damage Immunities</span>{' '}
                        {monster.damage_immunities?.join(', ')}
                    </p>
                )}
                {(monster.condition_immunities?.length ?? 0) > 0 && (
                    <p>
                        <span className="font-semibold">Condition Immunities</span>{' '}
                        {monster.condition_immunities?.join(', ')}
                    </p>
                )}
                {monster.senses && (
                    <p>
                        <span className="font-semibold">Senses</span>{' '}
                        {monster.senses.darkvision
                            ? `darkvision ${monster.senses.darkvision} ft., `
                            : ''}
                        passive Perception {monster.senses.passive_perception}
                    </p>
                )}
                {(monster.languages?.length ?? 0) > 0 && (
                    <p>
                        <span className="font-semibold">Languages</span>{' '}
                        {monster.languages?.join(', ')}
                    </p>
                )}
                <p>
                    <span className="font-semibold">Challenge</span>{' '}
                    {monster.challenge.rating} ({monster.challenge.xp} XP)
                </p>
            </div>

            {sc && (
                <div className="space-y-2 border-t border-amber-800/40 pt-2">
                    <h4 className="font-semibold">Spellcasting</h4>
                    <p className="text-xs text-muted-foreground">
                        {sc.ability ? `${sc.ability} ` : ''}
                        {sc.save_dc != null ? `save DC ${sc.save_dc}` : ''}
                        {sc.attack_bonus != null
                            ? `${sc.save_dc != null ? ', ' : ''}${formatModifier(sc.attack_bonus)} to hit`
                            : ''}
                    </p>
                    <SlotPips
                        max={slotMax}
                        expended={expended}
                        onChange={onSpellSlotChange}
                        interactive={interactive}
                    />
                    {atWill.length > 0 && (
                        <div>
                            <p className="font-semibold text-xs">At will</p>
                            <ul className="list-disc pl-4">
                                {atWill.map((s) => (
                                    <li key={`aw-${s.name}`}>
                                        <span className="font-medium">{s.name}</span>
                                        {s.notes ? ` — ${s.notes}` : ''}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {perDay.length > 0 && (
                        <div>
                            <p className="font-semibold text-xs">Limited use</p>
                            <ul className="space-y-1 pl-0">
                                {perDay.map((s) => {
                                    const used = innate[s.name] ?? 0;
                                    const max = s.per_day ?? 1;
                                    return (
                                        <li
                                            key={`pd-${s.name}`}
                                            className="flex flex-wrap items-center gap-2"
                                        >
                                            <span className="font-medium">
                                                {s.name} ({max}/day)
                                            </span>
                                            {s.notes ? (
                                                <span className="text-muted-foreground">
                                                    — {s.notes}
                                                </span>
                                            ) : null}
                                            {interactive && onInnateUseChange && (
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-xs"
                                                        disabled={used <= 0}
                                                        onClick={() =>
                                                            onInnateUseChange({
                                                                ...innate,
                                                                [s.name]: Math.max(0, used - 1),
                                                            })
                                                        }
                                                    >
                                                        +
                                                    </Button>
                                                    <span className="tabular-nums text-xs">
                                                        {max - used}/{max}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-xs"
                                                        disabled={used >= max}
                                                        onClick={() =>
                                                            onInnateUseChange({
                                                                ...innate,
                                                                [s.name]: Math.min(max, used + 1),
                                                            })
                                                        }
                                                    >
                                                        −
                                                    </Button>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                    {[...byLevel.entries()]
                        .sort(([a], [b]) => a - b)
                        .map(([level, spells]) => (
                            <div key={`lv-${level}`}>
                                <p className="font-semibold text-xs">
                                    {level === 0 ? 'Cantrips' : `${level}-level`}
                                </p>
                                <ul className="list-disc pl-4">
                                    {spells.map((s) => (
                                        <li key={`sl-${level}-${s.name}`}>
                                            <span className="font-medium">{s.name}</span>
                                            {s.notes ? ` — ${s.notes}` : ''}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                </div>
            )}

            {(monster.descriptions?.length ?? 0) > 0 && (
                <div className="space-y-2 border-t border-amber-800/40 pt-2">
                    {(monster.descriptions ?? []).map((d) => (
                        <p key={`trait-${d.title}`}>
                            <span className="font-semibold italic">{d.title}.</span> {d.description}
                        </p>
                    ))}
                </div>
            )}

            {(monster.actions?.length ?? 0) > 0 && (
                <div className="space-y-2 border-t border-amber-800/40 pt-2">
                    <h4 className="font-semibold">Actions</h4>
                    {interactiveAttacks && (
                        <p className="text-[10px] text-muted-foreground">
                            Underlined attacks: click to roll to-hit and damage
                        </p>
                    )}
                    <ActionLines
                        items={monster.actions ?? []}
                        interactiveAttacks={interactiveAttacks}
                    />
                </div>
            )}

            {(monster.reactions?.length ?? 0) > 0 && (
                <div className="space-y-2 border-t border-amber-800/40 pt-2">
                    <h4 className="font-semibold">Reactions</h4>
                    <ActionLines
                        items={monster.reactions ?? []}
                        interactiveAttacks={interactiveAttacks}
                    />
                </div>
            )}

            {(monster.legendary_actions?.length ?? 0) > 0 && (
                <div className="space-y-2 border-t border-amber-800/40 pt-2">
                    <h4 className="font-semibold">Legendary Actions</h4>
                    <ActionLines
                        items={monster.legendary_actions ?? []}
                        interactiveAttacks={interactiveAttacks}
                    />
                </div>
            )}
        </div>
    );
}
