'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import {
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { encounterService } from '@/services/encounter_service';
import type {
    EncounterDifficulty,
    EncounterGenerationResult,
    PartyThresholds,
} from '@/types/encounter';

interface EncounterGeneratorProps {
    onAddToInitiative: (
        monsters: Array<{ name: string; initiative: number; hp: number }>
    ) => void;
}

export function EncounterGenerator({ onAddToInitiative }: EncounterGeneratorProps) {
    const [partySize, setPartySize] = useState(4);
    const [partyLevel, setPartyLevel] = useState(1);
    const [difficulty, setDifficulty] = useState<EncounterDifficulty>('medium');
    const [thresholds, setThresholds] = useState<PartyThresholds | null>(null);
    const [result, setResult] = useState<EncounterGenerationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingThresholds, setLoadingThresholds] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoadingThresholds(true);
        encounterService
            .getXpLevels(partySize, partyLevel)
            .then((t) => {
                if (!cancelled) setThresholds(t);
            })
            .catch(() => {
                if (!cancelled) setThresholds(null);
            })
            .finally(() => {
                if (!cancelled) setLoadingThresholds(false);
            });
        return () => {
            cancelled = true;
        };
    }, [partySize, partyLevel]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const generated = await encounterService.generate({
                party_size: partySize,
                party_level: partyLevel,
                difficulty,
            });
            setResult(generated);
            if (!generated.within_tolerance) {
                toast({
                    title: 'Closest match',
                    description:
                        'Could not hit ±20% of the XP target with the local library; showing the closest pack.',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to generate encounter',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        if (!result?.monsters.length) return;
        onAddToInitiative(result.monsters);
        toast({
            title: 'Added to initiative',
            description: `Added ${result.monsters.length} combatant(s)`,
        });
    };

    return (
        <div className="space-y-6 text-zinc-900 dark:text-zinc-100">
            <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Encounter generator</DialogTitle>
                <DialogDescription className="text-sm text-zinc-600 dark:text-zinc-400">
                    Build a combat from the local monster library using 2014 XP thresholds
                    (±20% adjusted XP).
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                    <Label htmlFor="party-size">Party size</Label>
                    <Input
                        id="party-size"
                        type="number"
                        min={1}
                        max={12}
                        value={partySize}
                        onChange={(e) =>
                            setPartySize(Math.min(12, Math.max(1, Number(e.target.value) || 1)))
                        }
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="party-level">Party level</Label>
                    <Input
                        id="party-level"
                        type="number"
                        min={1}
                        max={20}
                        value={partyLevel}
                        onChange={(e) =>
                            setPartyLevel(
                                Math.min(20, Math.max(1, Number(e.target.value) || 1))
                            )
                        }
                    />
                </div>
                <div className="space-y-1">
                    <Label>Difficulty</Label>
                    <Select
                        value={difficulty}
                        onValueChange={(v) => setDifficulty(v as EncounterDifficulty)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                            <SelectItem value="deadly">Deadly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-700">
                <p className="mb-1 font-medium">Party XP thresholds</p>
                {loadingThresholds || !thresholds ? (
                    <p className="text-zinc-500">Loading…</p>
                ) : (
                    <p className="text-zinc-600 dark:text-zinc-400">
                        Easy {thresholds.easy} · Medium {thresholds.medium} · Hard{' '}
                        {thresholds.hard} · Deadly {thresholds.deadly}
                    </p>
                )}
            </div>

            <Button onClick={handleGenerate} disabled={loading}>
                {loading ? 'Generating…' : 'Generate'}
            </Button>

            {result && (
                <div className="space-y-3">
                    <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-700">
                        <p>
                            Target {result.target_xp} XP · Raw {result.monster_xp_total} ·
                            Adjusted {result.monster_xp_adjusted}
                            {result.within_tolerance ? '' : ' (outside ±20%)'}
                        </p>
                    </div>
                    <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
                        {result.monsters.map((m, i) => (
                            <li
                                key={`${m.name}-${i}-${m.initiative}-${m.hp}`}
                                className="flex items-center justify-between px-3 py-2 text-sm"
                            >
                                <span className="font-medium">{m.name}</span>
                                <span className="text-zinc-600 dark:text-zinc-400">
                                    Init {m.initiative} · HP {m.hp}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <Button variant="outline" onClick={handleAdd}>
                        Add to initiative
                    </Button>
                </div>
            )}
        </div>
    );
}
