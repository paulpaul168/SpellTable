'use client';

import React, {useEffect, useState} from 'react';
import {DialogHeader, DialogTitle} from './ui/dialog';
import {encounterService} from "@/services/encounter_service";
import {Button} from "@/components/ui/button";
import {toast} from "@/components/ui/use-toast";
import {EncounterGenerationRequest, EncounterGenerationResult, EncounterMonster, XpLevels} from "@/types/encounter";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {InitiativeSidebarHandle} from "@/components/InitiativeSidebar";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

interface EncounterGeneratorProps {
    initiativeSidebarRef?: React.RefObject<InitiativeSidebarHandle>;
}

export function EncounterGenerator({
                                       initiativeSidebarRef
                                   }: EncounterGeneratorProps) {

    // Form data
    const initialFormData: EncounterGenerationRequest = {
        character_levels: [],
        difficulty: 'medium',
        monsters: {'Goblin': 4, 'Goblin Boss': 1}
    }
    const [formData, setFormData] = useState<EncounterGenerationRequest>(initialFormData);

    // XP Levels
    const [xpLevels, setXpLevels] = useState<XpLevels | null>(null);

    // Generated encounter
    const [encounter, setEncounter] = useState<EncounterGenerationResult | null>(null);

    // === Data flow handlers ===
    // Fetch XP levels when character levels change
    useEffect(() => {
        if (formData.character_levels.length > 0) {
            handleFetchXpLevels().then(r => {});
        } else {
            setXpLevels(null)
        }
    }, [formData.character_levels]);

    // === Methods ===
    const handleFetchXpLevels = async () => {
        try {
            const xpLevels = await encounterService.getXpLevels(formData.character_levels);
            toast({
                title: "Success",
                description: "Fetched XP levels successfully",
            });
            setXpLevels(xpLevels)
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to fetch XP levels",
                variant: "destructive",
            });
        }
    }

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

    const addMonsterToInitiativeTracker = (monster: EncounterMonster) => {
        const handle = initiativeSidebarRef?.current;
        if (!handle) {
            return;
        }
        handle.addEntry(monster)
    }

    const addEncounterToInitiativeTracker = () => {
        const handle = initiativeSidebarRef?.current;
        if (!handle) {
            return;
        }
        handle.addEntries((encounter?.monsters ?? []))
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
    // UI Structure:
    // Party                        XP Goals
    // 8, 8, 8, 8 (Player levels)   Low         4000
    //                              Moderate    6800
    //                              Hard        8400
    //                              Deadly      12000
    //
    // Encounter
    // Dropdown: Difficulty (Low, Moderate, Hard, Deadly)
    //
    // Difficulty   Low
    // Total XP     6300 (1.575 per player)
    return (
        <div className="space-y-6">
            <DialogHeader>
                <DialogTitle>Encounter Generator</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="party-levels" className="text-zinc-700 dark:text-zinc-300">Party</Label>
                        <Input
                            id="party-levels"
                            // value={formData.character_levels.join(",")}
                            type="text"
                            placeholder="3, 3, 2, 3"
                            onChange={async (e) => {
                                const newLevels = e.target.value.split(",")
                                    .map(s => s.trim())
                                    .filter(s => s !== '')
                                    .map(s => Number(s));
                                setFormData({
                                    ...formData,
                                    character_levels: newLevels
                                });
                            }}
                            className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        />
                    </div>
                    <div className="space-y-1">
                        <p className="text-zinc-700 dark:text-zinc-300">XP Levels</p>
                        <div className="grid grid-cols-2 gap-x-4 text-sm text-zinc-700 dark:text-zinc-300">
                            <span>Low</span><span>{xpLevels?.easy}</span>
                            <span>Moderate</span><span>{xpLevels?.medium}</span>
                            <span>Hard</span><span>{xpLevels?.hard}</span>
                            <span>Deadly</span><span>{xpLevels?.deadly}</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="space-y-1">
                            Encounter
                        </div>
                        <div className="space-y-1">
                            <div className="grid grid-cols-2 gap-x-4">
                                <Label htmlFor="difficulty"
                                       className="text-zinc-700 dark:text-zinc-300">Difficulty</Label>
                                <Select /*value={formData.difficulty}*/
                                    onValueChange={(value: 'low' | 'moderate' | 'hard' | 'deadly') => setFormData({
                                        ...formData,
                                        /*difficulty: value*/
                                    })}>
                                    <SelectTrigger
                                        className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                        <SelectValue/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="moderate">Moderate</SelectItem>
                                        <SelectItem value="hard">Hard</SelectItem>
                                        <SelectItem value="deadly">Deadly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="monsters" className="text-zinc-700 dark:text-zinc-300">Monsters</Label>
                            <Input
                                id="monsters"
                                // value={Object.entries(formData.monsters).map(([name, count]) => `${name}:${count}`).join(', ')}
                                type="text"
                                placeholder="Goblin:4, Goblin Boss:1"
                                onChange={(e) => setFormData({
                                    ...formData,
                                    monsters: parseMonstersFromString(e.target.value)
                                })}
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            />
                        </div>
                    </div>
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
                            <p className="text-sm">Total XP: {encounter.monster_xp_with_modifiers} ({encounter.monster_xp_with_modifiers / encounter.player_count} per player)</p>
                        </div>
                        <div className="grid gap-2">
                            <p className="text-sm">Monsters:</p>
                            {encounter?.monsters.map((monster, index) => (
                                <div key={`monsters-${monster.name}-${monster.initiative}-${monster.hp}-${index}`}
                                     className="flex items-center justify-between">
                                    <div className="text-xs">
                                        {monster.name} | HP: {monster.hp} | Init: {monster.initiative}
                                    </div>
                                    {/*<Button*/}
                                    {/*    variant="outline"*/}
                                    {/*    size="sm"*/}
                                    {/*    onClick={() => addMonsterToInitiativeTracker(monster)}*/}
                                    {/*    className="px-1 py-1 text-xs border rounded bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">*/}
                                    {/*    Add to initiative Tracker*/}
                                    {/*</Button>*/}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addEncounterToInitiativeTracker}
                                disabled={false}
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
