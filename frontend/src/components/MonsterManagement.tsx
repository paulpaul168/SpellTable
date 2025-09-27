'use client';

import React, {useState, useEffect, useMemo} from 'react';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from './ui/dialog';
import {toast} from "@/components/ui/use-toast";
import {monsterService} from "@/services/monster_service";
import {Monster} from "@/types/monster";
import {CardContent} from "./ui/card";
import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Checkbox} from "@/components/ui/checkbox";

const PAGE_SIZE = 5;

export function MonsterManagement() {

    const [isLoading, setIsLoading] = useState(true);
    const [monsters, setMonsters] = useState<Monster[]>([]);

    // View dialog state
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [viewMonster, setViewMonster] = useState<Monster | null>(null);

    // Create/Edit dialog state
    const initialFormData: Monster = {
        name: '',
        size: 'medium',
        alignment: 'neutral',
        armor: {ac: 10, type: 'natural_armor', shield: false},
        hp: {average: 1, hit_dice: '1d1'},
        speed: {walk: 30},
        challenge: {rating: 1, xp: 200},
        saving_throws: [],
        skills: [],
        damage_resistances: [],
        damage_immunities: [],
        condition_immunities: [],
        senses: undefined,
        languages: [],
        descriptions: [],
        actions: [],
        reactions: [],
        legendary_actions: []
    };
    const [isCreateEditDialogOpen, setIsCreateEditDialogOpen] = useState(false);
    const [formData, setFormData] = useState<Monster>(initialFormData);
    const [editingMonsterName, setEditingMonsterName] = useState<string | null>(null);
    const [editingMonster, setEditingMonster] = useState<Monster | null>(null);

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
        if (!confirm(`Are you sure you want to delete the monster '${monsterName}'?`)) return;

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
        setIsViewDialogOpen(true);
    };

    // === Create/Edit dialog ===
    const resetCreateEditForm = () => {
        setFormData(initialFormData);
    };

    const openCreateDialog = () => {
        setEditingMonsterName(null);
        setEditingMonster(null);
        resetCreateEditForm();
        setIsCreateEditDialogOpen(true);
    };

    const openEditDialog = (monster: Monster) => {
        setEditingMonsterName(monster.name);
        setEditingMonster(convertMonsterEnumsFromApi(monster));
        setFormData(convertMonsterEnumsFromApi(monster));
        setIsCreateEditDialogOpen(true);
    };

    const handleCreate = async () => {
        try {
            await monsterService.createMonster(convertMonsterEnumsForApi(formData));
            toast({
                title: "Success",
                description: "Monster created successfully",
            });
            setIsCreateEditDialogOpen(false);
            resetCreateEditForm();
            loadMonsters();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to create monster",
                variant: "destructive",
            });
        }
    }

    const handleUpdate = async () => {
        if (!editingMonster || !editingMonsterName) {
            return;
        }

        try {
            await monsterService.updateMonster(editingMonsterName, convertMonsterEnumsForApi(formData));
            toast({
                title: "Success",
                description: "Monster updated successfully",
            });
            setIsCreateEditDialogOpen(false);
            resetCreateEditForm();
            loadMonsters();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update monster",
                variant: "destructive",
            });
            console.log(error.message);
        }
    }

    const handleCreateUpdateSubmit = () => {
        if (editingMonster) {
            handleUpdate();
        } else {
            handleCreate();
        }
    }

    // === Conversion ===
    const formatEnumForApi = (value: string): string =>  {
        return value.trim()
            .replace(/[_-]/g, ' ')
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    const formatEnumForFrontend = (value: string): string => {
        return value.trim()
            .replace(/ /g, '_')
            .toLowerCase();
    }

    const convertMonsterEnumsForApi = (monster: Monster): Monster => ({
        ...monster,
        size: formatEnumForApi(monster.size),
        alignment: monster.alignment ? formatEnumForApi(monster.alignment) : undefined,
        armor: {
            ...monster.armor,
            type: formatEnumForApi(monster.armor.type)
        }
    })

    const convertMonsterEnumsFromApi = (monster: Monster): Monster => ({
        ...monster,
        size: formatEnumForFrontend(monster.size),
        alignment: monster.alignment ? formatEnumForFrontend(monster.alignment) : undefined,
        armor: {
            ...monster.armor,
            type: formatEnumForFrontend(monster.armor.type)
        }
    })

    // === UI ===
    return (
        <div className="space-y-6">
            <DialogHeader>
                <DialogTitle>Monster Management</DialogTitle>
                <DialogDescription>
                    Manage the monsters.
                </DialogDescription>
            </DialogHeader>

            {/*onClick={openCreateDialog}*/}
            <div className="space-y-6">
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
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={openCreateDialog}
                        className="px-2 py-2 text-xs border rounded"
                    >
                        Add monster
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
                            <CardContent className="p-2" key={`monster-${monster.name}`}>
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
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(monster)}
                                            className="border-zinc-200 dark:border-zinc-700"
                                        >
                                            Edit
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
            </div>

            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                    <DialogHeader>
                        <DialogTitle
                            className="text-zinc-900 dark:text-zinc-100">{viewMonster?.name}</DialogTitle>
                        <DialogDescription className="text-zinc-600 dark:text-zinc-400">
                            {viewMonster?.size}, {viewMonster?.alignment}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <p>Armor Class {viewMonster?.armor.ac}:
                                ({viewMonster?.armor.type}{viewMonster?.armor?.shield ? ', Shield' : ''})</p>
                            <p>Hit Points {viewMonster?.hp.average}: ({viewMonster?.hp.hit_dice})</p>
                            <p>Speed: {Object.entries(viewMonster?.speed || {}).filter(([_, value]) => value != null).map(([key, value]) => `${key} ${value}`).join(', ')}</p>
                        </div>

                        {(viewMonster?.ability_scores &&
                            <div className="space-y-1">
                                {Object.entries(viewMonster?.ability_scores || {})
                                    .filter(([_, value]) => value != null)
                                    .map(([key, value]) => (
                                        <p key={key} className="text-sm">
                                            {key.charAt(0).toUpperCase() + key.slice(1)}: {value} ({(() => {
                                            const v = Math.floor(value / 2) - 5;
                                            return v >= 0 ? `+${v}` : `${v}`;
                                        })()})
                                        </p>
                                    ))}
                            </div>
                        )}

                        <div className="space-y-1">
                            {viewMonster?.saving_throws?.length > 0 &&
                                <p>
                                    Saving
                                    Throws: {viewMonster?.saving_throws?.map(st => `${st.saving_throw} ${st.modifier >= 0 ? '+' : '-'}${st.modifier}`).join(", ")}
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
                                            <div key={`description-${description.title}`}>
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
                                            <div key={`action-${description.title}`}>
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
                                            <div key={`reaction-${description.title}`}>
                                                <span className="font-semibold text-sm text-zinc-600 dark:text-zinc-400">{description.title}. </span>
                                                <span className="font-semitbold text-sm text-zinc-600 dark:text-zinc-400">{description.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {viewMonster?.legendary_actions?.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Legendary
                                            Actions:</h3>
                                        {viewMonster?.legendary_actions.map((description) => (
                                            <div key={`legendary-action-${description.title}`}>
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

            <Dialog open={isCreateEditDialogOpen} onOpenChange={setIsCreateEditDialogOpen}>
                <DialogContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                    <DialogHeader>
                        <DialogTitle className="text-zinc-900 dark:text-zinc-100">
                            {editingMonster ? 'Edit Monster' : 'Create Monster'}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-600 dark:text-zinc-400">
                            {editingMonster ? 'Update monster information' : 'Add a new monster to the system'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-zinc-700 dark:text-zinc-300">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="size" className="text-zinc-700 dark:text-zinc-300">Size</Label>
                            <Select value={formData.size}
                                    onValueChange={(value: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan') => setFormData({
                                        ...formData,
                                        size: value
                                    })}>
                                <SelectTrigger
                                    className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="tiny">Tiny</SelectItem>
                                    <SelectItem value="small">Small</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="large">Large</SelectItem>
                                    <SelectItem value="huge">Huge</SelectItem>
                                    <SelectItem value="gargantuan">Gargantuan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="alignment"
                                   className="text-zinc-700 dark:text-zinc-300">Alignment</Label>
                            <Select value={formData.alignment}
                                    onValueChange={(value: 'lawful_good' | 'neutral_good' | 'chaotic_good' | 'lawful_neutral' | 'neutral' | 'chaotic_neutral' | 'lawful_evil' | 'neutral_evil' | 'chaotic_evil' | 'Unaligned') => setFormData({
                                        ...formData,
                                        alignment: value
                                    })}>
                                <SelectTrigger
                                    className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="lawful_good">Lawful Good</SelectItem>
                                    <SelectItem value="neutral_good">Neutral Good</SelectItem>
                                    <SelectItem value="chaotic_good">Chaotic Good</SelectItem>
                                    <SelectItem value="lawful_neutral">Lawful Neutral</SelectItem>
                                    <SelectItem value="neutral">Neutral</SelectItem>
                                    <SelectItem value="chaotic_neutral">Chaotic Neutral</SelectItem>
                                    <SelectItem value="lawful_evil">Lawful Evil</SelectItem>
                                    <SelectItem value="neutral_evil">Neutral Evil</SelectItem>
                                    <SelectItem value="chaotic_evil">Chaotic Evil</SelectItem>
                                    <SelectItem value="unaligned">Unaligned</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="armor-class" className="text-zinc-700 dark:text-zinc-300">Armor
                                Class</Label>
                            <Input
                                id="armor-class"
                                type="number"
                                step="1"
                                min="0"
                                max="50"
                                placeholder="Armor Class"
                                value={formData.armor.ac}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    armor: {...formData.armor, ac: Number(e.target.value) || 0}
                                })}
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            />
                            <Label htmlFor="armor-type" className="text-zinc-700 dark:text-zinc-300">Armor
                                Type</Label>
                            <Select value={formData.armor.type}
                                    onValueChange={(value: 'padded' | 'leather' | 'studded_leather' | 'hide' | 'chain_shirt' | 'scale_mail' | 'breastplate' | 'half_plate' | 'ring_mail' | 'chain_mail' | 'splint' | 'plate' | 'natural_armor') => setFormData({
                                        ...formData,
                                        armor: {...formData.armor, type: value}
                                    })}>
                                <SelectTrigger
                                    className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="padded">Padded</SelectItem>
                                    <SelectItem value="leather">Leather</SelectItem>
                                    <SelectItem value="studded_leather">Studded Leather</SelectItem>
                                    <SelectItem value="hide">Hide</SelectItem>
                                    <SelectItem value="chain_shirt">Chain Shirt</SelectItem>
                                    <SelectItem value="scale_mail">Scale Mail</SelectItem>
                                    <SelectItem value="breastplate">Breastplate</SelectItem>
                                    <SelectItem value="half_plate">Half Plate</SelectItem>
                                    <SelectItem value="ring_mail">Ring Mail</SelectItem>
                                    <SelectItem value="chain_mail">Chain Mail</SelectItem>
                                    <SelectItem value="splint">Splint</SelectItem>
                                    <SelectItem value="plate">Plate</SelectItem>
                                    <SelectItem value="natural_armor">Natural Armor</SelectItem>
                                </SelectContent>
                            </Select>
                            <Label htmlFor="shield">Shield </Label>
                            <Checkbox
                                id="shield"
                                checked={formData.armor.shield}
                                onCheckedChange={(checked: boolean | "indeterminate") =>
                                    setFormData({
                                        ...formData,
                                        armor: {...formData.armor, shield: checked === true}
                                    })}

                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="hp-average" className="text-zinc-700 dark:text-zinc-300">HP
                                Average</Label>
                            <Input
                                id="hp-average"
                                type="number"
                                step="1"
                                min="1"
                                max="10000"
                                placeholder="Average"
                                value={formData.hp.average}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    hp: {...formData.hp, average: Number(e.target.value) || 0}
                                })}
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            />
                            <Label htmlFor="hit-dice" className="text-zinc-700 dark:text-zinc-300">Hit
                                Dice</Label>
                            <Input
                                id="hit-dice"
                                placeholder="Hit Dice"
                                value={formData.hp.hit_dice}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    hp: {...formData.hp, hit_dice: e.target.value}
                                })}
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="speed" className="text-zinc-700 dark:text-zinc-300">Speed</Label>
                            <Input
                                id="speed"
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                placeholder="Walk Speed"
                                value={formData.speed.walk}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    speed: {...formData.speed, walk: Number(e.target.value) || 0}
                                })}
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="challenge-rating" className="text-zinc-700 dark:text-zinc-300">Challenge
                                Rating</Label>
                            <Input
                                id="challenge-rating"
                                type="number"
                                step="0.125"
                                min="0"
                                max="30"
                                placeholder="Challenge Rating"
                                value={formData.challenge.rating}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    challenge: {...formData.challenge, rating: parseFloat(e.target.value) || 0}
                                })}
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            />
                            <Label htmlFor="challenge-xp" className="text-zinc-700 dark:text-zinc-300">Challenge
                                XP</Label>
                            <Input
                                id="challenge-xp"
                                type="number"
                                step="1"
                                min="0"
                                max="155000"
                                placeholder="XP"
                                value={formData.challenge.xp}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    challenge: {...formData.challenge, xp: Number(e.target.value) || 0}
                                })}
                                className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            />
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button variant="outline" onClick={() => setIsCreateEditDialogOpen(false)}
                                    className="border-zinc-200 dark:border-zinc-700">
                                Cancel
                            </Button>
                            <Button onClick={handleCreateUpdateSubmit}
                                    className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">
                                {editingMonster ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
