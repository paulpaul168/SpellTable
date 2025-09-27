'use client';

import React, {useState, useEffect, useMemo} from 'react';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from './ui/dialog';
import {Tabs, TabsContent, TabsList, TabsTrigger} from './ui/tabs';
import {toast} from "@/components/ui/use-toast";
import {monsterService} from "@/services/monster_service";
import {Monster} from "@/types/monster";
import {CardContent} from "./ui/card";
import {Button} from "./ui/button";
import {Input} from "./ui/input";

const PAGE_SIZE = 5;

export function MonsterManagement() {

    const [isLoading, setIsLoading] = useState(true);
    const [monsters, setMonsters] = useState<Monster[]>([]);

    // View dialog state
    const [isViewDialogOpen, setViewDialogOpen] = useState(false);
    const [viewMonster, setViewMonster] = useState<Monster | null>(null);

    // Search state
    const [nameQuery, setNameQuery] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadMonsters();
    }, []);

    const loadMonsters = async () => {
        try {
            setIsLoading(true);
            const monsterList = await monsterService.getMonsters();
            setMonsters(monsterList);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load monsters.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }

    // === Operations logic ===
    const handleDeleteMonster = async (monsterName: string) => {
        if (!confirm('Are you sure you want to delete this monster?')) return;

        try {
            await monsterService.deleteMonster(monsterName);
            toast({
                title: "Success",
                description: "Monster deleted successfully",
            });
            loadMonsters();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to delete monster",
                variant: "destructive",
            });
        }
    };

    // === Filtering logic ===
    const filteredMonsters = useMemo(() => {
        const query = nameQuery.trim().toLowerCase();
        if (!query) {
            return monsters;
        }
        return monsters.filter(monster => monster.name.toLowerCase().includes(query));
    }, [monsters, nameQuery]);

    // Reset to first page when filtering changes
    useEffect(() => {
        setCurrentPage(1);
    }, [nameQuery]);

    // === Pagination logic ===
    const totalPages = Math.max(1, Math.ceil(filteredMonsters.length / PAGE_SIZE));

    const visibleMonsters = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return filteredMonsters.slice(start, end);
    }, [filteredMonsters, currentPage]);

    const goToPreviousPage = () => setCurrentPage(p => Math.max(1, p - 1));

    const goToNextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));

    // === View dialog ===
    const openViewDialog = (monster: Monster) => {
        setViewMonster(monster);
        setViewDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <DialogHeader>
                <DialogTitle>Monster Management</DialogTitle>
                <DialogDescription>
                    Manage the monsters.
                </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="list">
                <TabsList>
                    <TabsTrigger value="list">List</TabsTrigger>
                    <TabsTrigger value="edit">Edit</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-6">
                    <div className="flex items-center gap-2">
                        <Input
                            type="text"
                            placeholder="Search monsters..."
                            value={nameQuery}
                            onChange={e => setNameQuery(e.target.value)}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNameQuery('')}
                            className="px-2 py-2 text-xs border rounded"
                        >
                            Clear
                        </Button>
                    </div>
                    {isLoading ? (
                        <div className="text-center py-8">
                            <div
                                className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto"></div>
                            <p className="mt-2 text-zinc-600 dark:text-zinc-400">Loading monsters...</p>
                        </div>
                    ) : filteredMonsters.length === 0 ? (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">No monsters found.</p>
                    ) : (
                        <div className="grid gap-4">
                            {visibleMonsters.map((monster) => (
                                <CardContent className="p-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div>
                                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                    {monster.name}
                                                </h3>
                                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {monster.size} | AC: {monster.armor.ac} |
                                                    HP: {monster.hp.average} ({monster.hp.hit_dice}) |
                                                    CR: {monster.challenge.rating}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openViewDialog(monster)}
                                                className="border-zinc-200 dark:border-zinc-700"
                                            >
                                                View
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDeleteMonster(monster.name)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            ))}
                            {/*Pagination controls*/}
                            <div className="flex items-center justify-between pt-2">
                                <button
                                    onClick={goToPreviousPage}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 rounded border text-sm disabled:opacity-40"
                                >
                                    Prev
                                </button>
                                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                    Page {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={goToNextPage}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 rounded border text-sm disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    <Dialog open={isViewDialogOpen} onOpenChange={setViewDialogOpen}>
                        <DialogContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                            <DialogHeader>
                                <DialogTitle className="text-zinc-900 dark:text-zinc-100">{viewMonster?.name}</DialogTitle>
                                <DialogDescription className="text-zinc-600 dark:text-zinc-400">
                                    {viewMonster?.size}, {viewMonster?.alignment}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <p>Armor Class {viewMonster?.armor.ac}: ({viewMonster?.armor.type}{viewMonster?.armor?.shield ? ', Shield' : ''})</p>
                                    <p>Hit Points {viewMonster?.hp.average}: ({viewMonster?.hp.hit_dice})</p>
                                    <p>Speed: {Object.entries(viewMonster?.speed || {}).filter(([_, value]) => value != null).map(([key, value]) => `${key} ${value}`).join(', ')}</p>
                                </div>

                                {(viewMonster?.ability_scores &&
                                    <div className="space-y-1">
                                        {Object.entries(viewMonster?.ability_scores || {})
                                            .filter(([_, value]) => value != null)
                                            .map(([key, value]) => (
                                                <p key={key} className="text-sm">
                                                    {key.charAt(0).toUpperCase() + key.slice(1)}: {value} ({(() => {const v = Math.floor(value / 2) - 5; return v >= 0 ? `+${v}` : `${v}`;}) ()})
                                                </p>
                                            ))}
                                    </div>
                                )}

                                <div className="space-y-1">
                                    {viewMonster?.saving_throws?.length > 0 &&
                                        <p>
                                            Saving Throws: {viewMonster?.saving_throws?.map(st => `${st.saving_throw} ${st.modifier >= 0 ? '+' : '-'}${st.modifier}`).join(", ")}
                                        </p>
                                    }
                                    {viewMonster?.skills?.length > 0 &&
                                        <p>
                                            Skills: {viewMonster?.skills?.map(skill => `${skill.skill} ${skill.modifier >= 0 ? '+' : '-'}${skill.modifier}`).join(", ")}
                                        </p>
                                    }
                                    {viewMonster?.damage_resistances?.length > 0 &&
                                        <p>
                                            Damage resistances: {viewMonster?.damage_resistances?.join(', ')}
                                        </p>
                                    }
                                    {viewMonster?.damage_immunities?.length > 0 &&
                                        <p>
                                            Damage immunities: {viewMonster?.damage_immunities?.join(', ')}
                                        </p>
                                    }
                                    {viewMonster?.condition_immunities?.length > 0 &&
                                        <p>
                                            Condition immunities: {viewMonster?.condition_immunities?.join(', ')}
                                        </p>
                                    }
                                    {viewMonster?.senses &&
                                        <p>
                                            Senses: {viewMonster?.senses.darkvision ? ` Darkvision ${viewMonster.senses.darkvision} ft., ` : ''}
                                            passive Perception {viewMonster?.senses.passive_perception}
                                        </p>
                                    }
                                    {viewMonster?.languages?.length > 0 &&
                                        <p>
                                            Languages: {viewMonster?.languages && viewMonster?.languages?.length === 0 ? '-' : viewMonster?.languages?.join(', ')}
                                        </p>
                                    }
                                    <p>
                                        Challenge: {viewMonster?.challenge.rating} ({viewMonster?.challenge.xp} XP)
                                    </p>
                                </div>

                                {(
                                        (viewMonster?.descriptions?.length ?? 0) > 0 ||
                                        (viewMonster?.actions?.length ?? 0) > 0 ||
                                        (viewMonster?.reactions?.length ?? 0) > 0 ||
                                        (viewMonster?.legendary_actions?.length ?? 0) > 0
                                    ) &&
                                    <div className="space-y-3">
                                        {viewMonster?.descriptions?.length > 0 && (
                                            <div className="space-y-2">
                                                {viewMonster?.descriptions.map((description) => (
                                                    <div>
                                                        <span className="font-semibold text-sm text-zinc-600 dark:text-zinc-400">{description.title}. </span>
                                                        <span className="font-semitbold text-sm text-zinc-600 dark:text-zinc-400">{description.description}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {viewMonster?.actions?.length > 0 && (
                                            <div className="space-y-2">
                                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Actions:</h3>
                                                {viewMonster?.actions.map((description) => (
                                                    <div>
                                                        <span className="font-semibold text-sm text-zinc-600 dark:text-zinc-400">{description.title}. </span>
                                                        <span className="font-semitbold text-sm text-zinc-600 dark:text-zinc-400">{description.description}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {viewMonster?.reactions?.length > 0 && (
                                            <div className="space-y-2">
                                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Reactions:</h3>
                                                {viewMonster?.reactions.map((description) => (
                                                    <div>
                                                        <span className="font-semibold text-sm text-zinc-600 dark:text-zinc-400">{description.title}. </span>
                                                        <span className="font-semitbold text-sm text-zinc-600 dark:text-zinc-400">{description.description}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {viewMonster?.legendary_actions?.length > 0 && (
                                            <div className="space-y-2">
                                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Legendary Actions:</h3>
                                                {viewMonster?.legendary_actions.map((description) => (
                                                    <div>
                                                        <span className="font-semibold text-sm text-zinc-600 dark:text-zinc-400">{description.title}. </span>
                                                        <span className="font-semitbold text-sm text-zinc-600 dark:text-zinc-400">{description.description}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                }
                            </div>
                        </DialogContent>
                    </Dialog>
                </TabsContent>
            </Tabs>
        </div>
    );
}
