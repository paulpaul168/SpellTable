'use client';

import React, { useEffect, useState } from 'react';
import type { InitiativeEntry } from '@/types/map';
import type { Monster } from '@/types/monster';
import { monsterService } from '@/services/monster_service';
import { MonsterStatBlock } from '@/components/MonsterStatBlock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { emptySpellSlotArray, normalizeSpellSlotArray } from '@/utils/spellSlots';
import { snapshotSpellSlots } from '@/utils/monsterCombat';

type Props = {
    entry: InitiativeEntry | null;
    onUpdateEntry: (patch: Partial<InitiativeEntry>) => void;
    onLinkMonster: (monsterName: string) => void;
};

export function EnemyCombatPanel({ entry, onUpdateEntry, onLinkMonster }: Props) {
    const [monster, setMonster] = useState<Monster | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [library, setLibrary] = useState<Monster[]>([]);
    const [auroraLibrary, setAuroraLibrary] = useState<
        { monsterName: string; name: string; label: string }[]
    >([]);
    const [fc5Library, setFc5Library] = useState<
        { monsterName: string; name: string; label: string }[]
    >([]);
    const [linkQuery, setLinkQuery] = useState('');
    const [showLink, setShowLink] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (!entry || entry.isPlayer || !entry.monsterName) {
            setMonster(null);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        monsterService
            .getMonster(entry.monsterName)
            .then((m) => {
                if (!cancelled) setMonster(m);
            })
            .catch((err) => {
                if (!cancelled) {
                    setMonster(null);
                    setError(err instanceof Error ? err.message : 'Failed to load monster');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [entry?.id, entry?.monsterName, entry?.isPlayer]);

    useEffect(() => {
        if (!showLink) return;
        let cancelled = false;
        monsterService
            .getMonsters()
            .then((list) => {
                if (!cancelled) setLibrary(list);
            })
            .catch(() => {
                if (!cancelled) setLibrary([]);
            });
        monsterService
            .getAuroraMonsters()
            .then((list) => {
                if (cancelled) return;
                setAuroraLibrary(
                    list.map((c) => ({
                        monsterName: c.monsterName,
                        name: c.name,
                        label: `aurora · AC ${c.ac ?? '—'} · HP ${c.hp_average ?? '—'}`,
                    }))
                );
            })
            .catch(() => {
                if (!cancelled) setAuroraLibrary([]);
            });
        monsterService
            .getFc5Monsters(undefined, 20000)
            .then((list) => {
                if (cancelled) return;
                setFc5Library(
                    list.map((c) => ({
                        monsterName: c.monsterName,
                        name: c.name,
                        label: `fc5 · AC ${c.ac ?? '—'} · HP ${c.hp_average ?? '—'}`,
                    }))
                );
            })
            .catch(() => {
                if (!cancelled) setFc5Library([]);
            });
        return () => {
            cancelled = true;
        };
    }, [showLink]);

    if (!entry || entry.isPlayer) {
        return (
            <div className="rounded-md border border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
                Select an enemy or advance to an enemy turn to see the combat stat block.
            </div>
        );
    }

    const q = linkQuery.trim().toLowerCase();
    const filteredLibrary = library.filter((m) => m.name.toLowerCase().includes(q));
    const filteredAurora = auroraLibrary.filter((m) => m.name.toLowerCase().includes(q));
    // Keep FC5 out of the tiny link list until the user types — then filter locally.
    const filteredFc5 =
        q.length < 2
            ? []
            : fc5Library.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 40);

    return (
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-background/50 p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Enemy stat block
                </p>
                {!entry.monsterName && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setShowLink((v) => !v)}
                    >
                        Link monster…
                    </Button>
                )}
            </div>

            {showLink && !entry.monsterName && (
                <div className="space-y-2 rounded border border-dashed border-border p-2">
                    <Label className="text-xs">Link library monster</Label>
                    <Input
                        placeholder="Search…"
                        value={linkQuery}
                        onChange={(e) => setLinkQuery(e.target.value)}
                        className="h-8"
                    />
                    <ul className="max-h-28 space-y-1 overflow-y-auto text-sm">
                        {filteredLibrary.map((m) => (
                            <li key={`local-${m.name}`} className="flex justify-between gap-2">
                                <span className="truncate">
                                    {m.name}{' '}
                                    <span className="text-xs text-muted-foreground">local</span>
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-6 shrink-0 px-2 text-xs"
                                    onClick={() => {
                                        onLinkMonster(m.name);
                                        setShowLink(false);
                                    }}
                                >
                                    Link
                                </Button>
                            </li>
                        ))}
                        {filteredAurora.map((m) => (
                            <li key={m.monsterName} className="flex justify-between gap-2">
                                <span className="truncate">
                                    {m.name}{' '}
                                    <span className="text-xs text-muted-foreground">{m.label}</span>
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-6 shrink-0 px-2 text-xs"
                                    onClick={() => {
                                        onLinkMonster(m.monsterName);
                                        setShowLink(false);
                                    }}
                                >
                                    Link
                                </Button>
                            </li>
                        ))}
                        {filteredFc5.map((m) => (
                            <li key={m.monsterName} className="flex justify-between gap-2">
                                <span className="truncate">
                                    {m.name}{' '}
                                    <span className="text-xs text-muted-foreground">{m.label}</span>
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-6 shrink-0 px-2 text-xs"
                                    onClick={() => {
                                        onLinkMonster(m.monsterName);
                                        setShowLink(false);
                                    }}
                                >
                                    Link
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
            {error && <p className="text-xs text-destructive">{error}</p>}

            {!entry.monsterName && !loading && (
                <div className="text-sm">
                    <p className="font-medium text-red-200">{entry.name}</p>
                    {entry.hp !== undefined && (
                        <p className="text-muted-foreground">
                            HP {entry.hp}
                            {entry.initialHP !== undefined ? ` / ${entry.initialHP}` : ''}
                        </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                        No library monster linked. Add from library or link one above.
                    </p>
                </div>
            )}

            {monster && (
                <MonsterStatBlock
                    monster={monster}
                    currentHP={entry.hp}
                    compact
                    spellSlotMaximum={
                        entry.spellSlotMaximum ?? snapshotSpellSlots(monster)
                    }
                    spellSlotsExpended={
                        entry.spellSlotsExpended ?? emptySpellSlotArray()
                    }
                    innateUsesExpended={entry.innateUsesExpended ?? {}}
                    onSpellSlotChange={(expended) =>
                        onUpdateEntry({
                            spellSlotsExpended: normalizeSpellSlotArray(expended),
                        })
                    }
                    onInnateUseChange={(innateUsesExpended) =>
                        onUpdateEntry({ innateUsesExpended })
                    }
                />
            )}
        </div>
    );
}
