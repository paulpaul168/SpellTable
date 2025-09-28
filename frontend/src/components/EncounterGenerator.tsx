'use client';

import React, {useState} from 'react';
import {DialogHeader, DialogTitle} from './ui/dialog';
import {encounterService} from "@/services/encounter_service";
import {Button} from "@/components/ui/button";
import {toast} from "@/components/ui/use-toast";
import {EncounterGenerationRequest, EncounterGenerationResult} from "@/types/encounter";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";

export function EncounterGenerator() {

    // Form data
    const initialFormData: EncounterGenerationRequest = {
        character_levels: [3, 3, 2, 3],
        difficulty: 'medium',
        monsters: {'Goblin': 4, 'Goblin Boss': 1}
    }
    const [formData, setFormData] = useState<EncounterGenerationRequest>(initialFormData);

    // Generated encounter
    const [encounter, setEncounter] = useState<EncounterGenerationResult | null>(null);

    const handleGenerateEncounter = async () => {
        try {
            const encounter = await encounterService.createEncounter(formData);
            toast({
                title: "Success",
                description: "Generated encounter successfully",
            });
            setEncounter(encounter)
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to generate encounter",
                variant: "destructive",
            });
        }
    }

    const parseMonstersFromString = (input: string): Record<string, number> => {
        return input
            .split(',')
            .map(pair => pair.trim())
            .filter(Boolean) // Remove empty strings
            .reduce((acc, curr) => {
                const [name, count] = curr.split(':').map(s => s.trim());
                if (name && count && !isNaN(Number(count))) {
                    acc[name] = Number(count);
                }
                return acc;
            }, {} as Record<string, number>);
    }

    // === UI ===
    return (
        <div className="space-y-6">
            <DialogHeader>
                <DialogTitle>Encounter Generator</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="monsters" className="text-zinc-700 dark:text-zinc-300">Monsters</Label>
                        <Input
                            id="monsters"
                            // value={Object.entries(formData.monsters).map(([name, count]) => `${name}:${count}`).join(', ')}
                            type="text"
                            placeholder="Goblin:4, Goblin Boss:1"
                            onChange={(e) => setFormData({...formData, monsters: parseMonstersFromString(e.target.value)})}
                            className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="players-levels" className="text-zinc-700 dark:text-zinc-300">Player levels</Label>
                        <Input
                            id="player-levels"
                            // value={formData.character_levels.join(",")}
                            type="text"
                            placeholder="3, 3, 2, 3"
                            onChange={(e) => setFormData({...formData, character_levels: e.target.value.split(",").map(s => Number(s.trim()))})}
                            className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        />
                    </div>
                    <div className="space-y-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateEncounter}
                            className="px-2 py-2 text-xs border rounded bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                        >
                            Generate
                        </Button>
                    </div>
                </div>

                {!encounter ? (
                    <div className="grid gap-4">
                        No encounter generated yet.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        Generated encounter:
                        <div className="space-y-1">
                            <p className="text-sm">Monster XP Total: {encounter.monster_xp_total}</p>
                            <p className="text-sm">Monster XP with Modifiers: {encounter.monster_xp_with_modifiers}</p>
                            <p className="text-sm">Difficulty Rating: {encounter.difficulty_rating}</p>
                            <p className="text-sm">
                                Party Difficulty Thresholds:
                                <ul>
                                    <li className="text-xs">- Easy: {encounter.party_difficulty_thresholds.easy}</li>
                                    <li className="text-xs">- Medium: {encounter.party_difficulty_thresholds.medium}</li>
                                    <li className="text-xs">- Hard: {encounter.party_difficulty_thresholds.hard}</li>
                                    <li className="text-xs">- Deadly: {encounter.party_difficulty_thresholds.deadly}</li>
                                </ul>
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <p className="text-sm">Monsters:</p>
                            {encounter?.monsters.map((monster) => (
                                <div className="flex items-center justify-between">
                                    <div className="text-xs">
                                        {monster.name} | HP: {monster.hp} | Init: {monster.initiative}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                className="px-2 py-2 text-xs border rounded bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">
                                Add to initiative Tracker
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
