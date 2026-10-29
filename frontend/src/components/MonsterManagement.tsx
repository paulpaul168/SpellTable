'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { monsterService } from '@/services/monster_service';
import { spellCatalogService } from '@/services/spell_catalog_service';
import type {
    AuroraMonsterSummary,
    Description,
    Fc5MonsterSummary,
    Monster,
    MonsterSpell,
    MonsterSpellcasting,
} from '@/types/monster';
import { CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { MonsterStatBlock } from '@/components/MonsterStatBlock';
import { SpellCatalogPicker } from '@/components/SpellCatalogPicker';
import { emptySpellSlotArray, normalizeSpellSlotArray } from '@/utils/spellSlots';

const PAGE_SIZE = 5;
const FC5_PAGE_SIZE = 40;

const ENVIRONMENT_PRESETS = [
    'arctic',
    'coastal',
    'desert',
    'forest',
    'grassland',
    'hill',
    'mountain',
    'swamp',
    'underdark',
    'underwater',
    'urban',
] as const;

function filterCatalogSummaries<
    T extends { name: string; source?: string; creature_type?: string },
>(items: T[], query: string): T[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRe = new RegExp(`\\b${escaped}\\b`);
    const scored = items
        .map((item) => {
            const name = item.name.toLowerCase();
            let rank = 9;
            if (name === q) rank = 0;
            else if (name.startsWith(q)) rank = 1;
            else if (wordRe.test(name)) rank = 2;
            else if (name.includes(q)) rank = 3;
            else if ((item.creature_type || '').toLowerCase().includes(q)) rank = 4;
            else if ((item.source || '').toLowerCase().includes(q)) rank = 5;
            else return null;
            return { item, rank, name };
        })
        .filter((x): x is { item: T; rank: number; name: string } => x !== null);
    scored.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
    return scored.map((x) => x.item);
}

const emptyAbilityScores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
};

function emptySpellcasting(): MonsterSpellcasting {
    return {
        ability: 'intelligence',
        save_dc: 13,
        attack_bonus: 5,
        slots: emptySpellSlotArray(),
        spells: [],
    };
}

function DescriptionListEditor({
    label,
    items,
    onChange,
}: {
    label: string;
    items: Description[];
    onChange: (next: Description[]) => void;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onChange([...items, { title: '', description: '' }])}
                >
                    Add
                </Button>
            </div>
            {items.map((item, index) => (
                <div
                    key={`${label}-${index}`}
                    className="space-y-1 rounded border border-zinc-200 p-2 dark:border-zinc-700"
                >
                    <Input
                        placeholder="Title"
                        value={item.title}
                        onChange={(e) => {
                            const next = [...items];
                            next[index] = { ...item, title: e.target.value };
                            onChange(next);
                        }}
                    />
                    <textarea
                        placeholder="Description"
                        value={item.description}
                        rows={2}
                        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        onChange={(e) => {
                            const next = [...items];
                            next[index] = { ...item, description: e.target.value };
                            onChange(next);
                        }}
                    />
                    <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => onChange(items.filter((_, i) => i !== index))}
                    >
                        Remove
                    </Button>
                </div>
            ))}
        </div>
    );
}

export function MonsterManagement() {
    const [isLoading, setIsLoading] = useState(true);
    const [monsters, setMonsters] = useState<Monster[]>([]);
    const [catalogAvailable, setCatalogAvailable] = useState(false);
    const [libraryTab, setLibraryTab] = useState<'local' | 'aurora' | 'fc5'>('local');
    const [auroraMonsters, setAuroraMonsters] = useState<AuroraMonsterSummary[]>([]);
    const [auroraLoading, setAuroraLoading] = useState(false);
    const [auroraAvailable, setAuroraAvailable] = useState(false);
    const [fc5Monsters, setFc5Monsters] = useState<Fc5MonsterSummary[]>([]);
    const [fc5Loading, setFc5Loading] = useState(false);
    const [fc5Available, setFc5Available] = useState(false);
    const [fc5TotalCount, setFc5TotalCount] = useState(0);

    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [viewMonster, setViewMonster] = useState<Monster | null>(null);

    const initialFormData: Monster = {
        name: '',
        size: 'medium',
        alignment: 'neutral',
        armor: { ac: 10, type: 'natural_armor', shield: false },
        hp: { average: 1, hit_dice: '1d8' },
        speed: { walk: 30 },
        ability_scores: { ...emptyAbilityScores },
        challenge: { rating: 1, xp: 200 },
        environments: [],
        saving_throws: [],
        skills: [],
        damage_resistances: [],
        damage_immunities: [],
        condition_immunities: [],
        senses: { passive_perception: 10 },
        languages: [],
        descriptions: [],
        actions: [],
        reactions: [],
        legendary_actions: [],
        spellcasting: undefined,
    };

    const [isCreateEditDialogOpen, setIsCreateEditDialogOpen] = useState(false);
    const [formData, setFormData] = useState<Monster>(initialFormData);
    const [editingMonsterName, setEditingMonsterName] = useState<string | null>(null);
    const [editingMonster, setEditingMonster] = useState<Monster | null>(null);

    const [nameQuery, setNameQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadMonsters();
        spellCatalogService
            .isAvailable()
            .then(setCatalogAvailable)
            .catch(() => setCatalogAvailable(false));
        monsterService.getAuroraCatalogStatus().then((s) => {
            setAuroraAvailable(s.available);
            if (s.available) void loadAuroraMonsters();
        });
        monsterService.getFc5CatalogStatus().then((s) => {
            setFc5Available(s.available);
            setFc5TotalCount(s.count);
        });
    }, []);

    const loadMonsters = async () => {
        try {
            setIsLoading(true);
            const monsterList = await monsterService.getMonsters();
            setMonsters(monsterList);
        } catch {
            toast({
                title: 'Error',
                description: 'Failed to load monsters.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const loadAuroraMonsters = async () => {
        try {
            // Only flash loading on the first empty fetch — never while typing.
            if (auroraMonsters.length === 0) setAuroraLoading(true);
            const list = await monsterService.getAuroraMonsters();
            setAuroraMonsters(list);
            setAuroraAvailable(true);
        } catch {
            setAuroraMonsters([]);
        } finally {
            setAuroraLoading(false);
        }
    };

    const loadFc5Monsters = async () => {
        try {
            if (fc5Monsters.length === 0) setFc5Loading(true);
            const list = await monsterService.getFc5Monsters(undefined, 20000);
            setFc5Monsters(list);
            setFc5Available(true);
            setFc5TotalCount(list.length);
        } catch {
            setFc5Monsters([]);
        } finally {
            setFc5Loading(false);
        }
    };

    const knownLanguages = new Set([
        'Common',
        'Dwarvish',
        'Elvish',
        'Giant',
        'Gnomish',
        'Goblin',
        'Halfling',
        'Orc',
        'Undercommon',
    ]);

    const sanitizeImportedMonster = (monster: Monster): Monster => ({
        ...monster,
        languages: (monster.languages || []).filter((l) => knownLanguages.has(l)),
        environments: monster.environments ?? [],
        damage_resistances: [],
        damage_immunities: [],
        condition_immunities: [],
    });

    const toggleEnvironment = (env: string, checked: boolean) => {
        const current = formData.environments ?? [];
        const next = checked
            ? current.includes(env)
                ? current
                : [...current, env]
            : current.filter((e) => e !== env);
        setFormData({ ...formData, environments: next });
    };

    const openAuroraView = async (summary: AuroraMonsterSummary) => {
        try {
            const monster = await monsterService.getMonster(summary.monsterName);
            setViewMonster(monster);
            setIsViewDialogOpen(true);
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error
                        ? error.message
                        : 'Failed to load Aurora creature',
                variant: 'destructive',
            });
        }
    };

    const openFc5View = async (summary: Fc5MonsterSummary) => {
        try {
            const monster = await monsterService.getMonster(summary.monsterName);
            setViewMonster(monster);
            setIsViewDialogOpen(true);
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to load FC5 creature',
                variant: 'destructive',
            });
        }
    };

    const importAuroraToLocal = async (summary: AuroraMonsterSummary) => {
        try {
            const monster = await monsterService.getMonster(summary.monsterName);
            const {
                aurora_id: _a,
                aurora_source: _s,
                aurora_creature_type: _t,
                ...rest
            } = monster as Monster & {
                aurora_id?: string;
                aurora_source?: string;
                aurora_creature_type?: string;
            };
            await monsterService.createMonster(sanitizeImportedMonster(rest));
            toast({
                title: 'Imported',
                description: `Saved ${monster.name} to local library`,
            });
            loadMonsters();
            setLibraryTab('local');
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to import creature',
                variant: 'destructive',
            });
        }
    };

    const importFc5ToLocal = async (summary: Fc5MonsterSummary) => {
        try {
            const monster = await monsterService.getMonster(summary.monsterName);
            const {
                fc5_id: _id,
                fc5_source: _src,
                fc5_creature_type: _type,
                ...rest
            } = monster as Monster & {
                fc5_id?: string;
                fc5_source?: string;
                fc5_creature_type?: string;
            };
            await monsterService.createMonster(sanitizeImportedMonster(rest));
            toast({
                title: 'Imported',
                description: `Saved ${monster.name} to local library`,
            });
            loadMonsters();
            setLibraryTab('local');
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to import creature',
                variant: 'destructive',
            });
        }
    };

    const handleDeleteMonster = async (monsterName: string) => {
        if (!confirm(`Are you sure you want to delete the monster '${monsterName}'?`)) return;
        try {
            await monsterService.deleteMonster(monsterName);
            toast({ title: 'Success', description: 'Monster deleted successfully' });
            loadMonsters();
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to delete monster',
                variant: 'destructive',
            });
        }
    };

    const filteredMonsters = useMemo(() => {
        const query = nameQuery.trim().toLowerCase();
        if (!query) return monsters;
        return monsters.filter((monster) => monster.name.toLowerCase().includes(query));
    }, [monsters, nameQuery]);

    const filteredAuroraMonsters = useMemo(
        () => filterCatalogSummaries(auroraMonsters, nameQuery),
        [auroraMonsters, nameQuery]
    );

    const filteredFc5Monsters = useMemo(
        () => filterCatalogSummaries(fc5Monsters, nameQuery),
        [fc5Monsters, nameQuery]
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [nameQuery, libraryTab]);

    const totalPages = Math.max(1, Math.ceil(filteredMonsters.length / PAGE_SIZE));
    const visibleMonsters = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredMonsters.slice(start, start + PAGE_SIZE);
    }, [filteredMonsters, currentPage]);

    const fc5TotalPages = Math.max(1, Math.ceil(filteredFc5Monsters.length / FC5_PAGE_SIZE));
    const visibleFc5Monsters = useMemo(() => {
        const start = (currentPage - 1) * FC5_PAGE_SIZE;
        return filteredFc5Monsters.slice(start, start + FC5_PAGE_SIZE);
    }, [filteredFc5Monsters, currentPage]);

    const openViewDialog = (monster: Monster) => {
        setViewMonster(monster);
        setIsViewDialogOpen(true);
    };

    const resetCreateEditForm = () => setFormData(initialFormData);

    const openCreateDialog = () => {
        setEditingMonsterName(null);
        setEditingMonster(null);
        resetCreateEditForm();
        setIsCreateEditDialogOpen(true);
    };

    const openEditDialog = (monster: Monster) => {
        setEditingMonsterName(monster.name);
        const converted = convertMonsterEnumsFromApi(monster);
        setEditingMonster(converted);
        setFormData({
            ...converted,
            ability_scores: converted.ability_scores ?? { ...emptyAbilityScores },
            senses: converted.senses ?? { passive_perception: 10 },
            spellcasting: converted.spellcasting
                ? {
                      ...converted.spellcasting,
                      slots: normalizeSpellSlotArray(converted.spellcasting.slots),
                      spells: converted.spellcasting.spells ?? [],
                  }
                : undefined,
        });
        setIsCreateEditDialogOpen(true);
    };

    const handleCreate = async () => {
        try {
            await monsterService.createMonster(convertMonsterEnumsForApi(formData));
            toast({ title: 'Success', description: 'Monster created successfully' });
            setIsCreateEditDialogOpen(false);
            resetCreateEditForm();
            loadMonsters();
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to create monster',
                variant: 'destructive',
            });
        }
    };

    const handleUpdate = async () => {
        if (!editingMonster || !editingMonsterName) return;
        try {
            await monsterService.updateMonster(
                editingMonsterName,
                convertMonsterEnumsForApi(formData)
            );
            toast({ title: 'Success', description: 'Monster updated successfully' });
            setIsCreateEditDialogOpen(false);
            resetCreateEditForm();
            loadMonsters();
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to update monster',
                variant: 'destructive',
            });
        }
    };

    const handleCreateUpdateSubmit = () => {
        if (editingMonster) handleUpdate();
        else handleCreate();
    };

    const formatEnumForApi = (value: string): string =>
        value
            .trim()
            .replace(/[_-]/g, ' ')
            .toLowerCase()
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

    const formatEnumForFrontend = (value: string): string =>
        value.trim().replace(/ /g, '_').toLowerCase();

    const convertMonsterEnumsForApi = (monster: Monster): Monster => ({
        ...monster,
        size: formatEnumForApi(monster.size)!,
        alignment: monster.alignment ? formatEnumForApi(monster.alignment) : undefined,
        armor: {
            ...monster.armor,
            ...(monster.armor.type ? { type: formatEnumForApi(monster.armor.type) } : {}),
        },
    });

    const convertMonsterEnumsFromApi = (monster: Monster): Monster => ({
        ...monster,
        size: formatEnumForFrontend(monster.size),
        alignment: monster.alignment ? formatEnumForFrontend(monster.alignment) : undefined,
        armor: {
            ...monster.armor,
            ...(monster.armor.type ? { type: formatEnumForFrontend(monster.armor.type) } : {}),
        },
    });

    const updateSpellcasting = (patch: Partial<MonsterSpellcasting> | null) => {
        if (patch === null) {
            setFormData({ ...formData, spellcasting: undefined });
            return;
        }
        const base = formData.spellcasting ?? emptySpellcasting();
        setFormData({ ...formData, spellcasting: { ...base, ...patch } });
    };

    const updateSpell = (index: number, patch: Partial<MonsterSpell>) => {
        const sc = formData.spellcasting ?? emptySpellcasting();
        const spells = [...(sc.spells ?? [])];
        spells[index] = { ...spells[index], ...patch };
        updateSpellcasting({ spells });
    };

    const scores = formData.ability_scores ?? emptyAbilityScores;
    const slots = normalizeSpellSlotArray(formData.spellcasting?.slots);

    return (
        <div className="space-y-6">
            <DialogHeader>
                <DialogTitle>Monster Management</DialogTitle>
                <DialogDescription>Manage the monsters.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant={libraryTab === 'local' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLibraryTab('local')}
                    >
                        Local ({monsters.length})
                    </Button>
                    <Button
                        variant={libraryTab === 'aurora' ? 'default' : 'outline'}
                        size="sm"
                        disabled={!auroraAvailable && auroraMonsters.length === 0}
                        onClick={() => {
                            setLibraryTab('aurora');
                            if (auroraMonsters.length === 0) void loadAuroraMonsters();
                        }}
                    >
                        Aurora {auroraAvailable ? `(${auroraMonsters.length || '…'})` : '(off)'}
                    </Button>
                    <Button
                        variant={libraryTab === 'fc5' ? 'default' : 'outline'}
                        size="sm"
                        disabled={!fc5Available && fc5Monsters.length === 0}
                        onClick={() => {
                            setLibraryTab('fc5');
                            if (fc5Monsters.length === 0) void loadFc5Monsters();
                        }}
                    >
                        FC5{' '}
                        {fc5Available
                            ? `(${fc5TotalCount || fc5Monsters.length || '…'})`
                            : '(off)'}
                    </Button>
                    <Input
                        type="text"
                        placeholder={
                            libraryTab === 'aurora'
                                ? 'Search Aurora creatures…'
                                : libraryTab === 'fc5'
                                  ? 'Search FC5 bestiary…'
                                  : 'Search monsters…'
                        }
                        value={nameQuery}
                        onChange={(e) => setNameQuery(e.target.value)}
                        className="max-w-sm"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNameQuery('')}
                    >
                        Clear
                    </Button>
                    {libraryTab === 'local' && (
                        <Button variant="outline" size="sm" onClick={openCreateDialog}>
                            Add monster
                        </Button>
                    )}
                </div>

                {libraryTab === 'local' &&
                    (isLoading ? (
                        <div className="py-8 text-center">
                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-zinc-900 dark:border-zinc-100" />
                            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                                Loading monsters...
                            </p>
                        </div>
                    ) : filteredMonsters.length === 0 ? (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            No monsters found.
                        </p>
                    ) : (
                        <div className="grid gap-4">
                            {visibleMonsters.map((monster) => (
                                <CardContent className="p-2" key={`monster-${monster.name}`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                {monster.name}
                                            </h3>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {monster.size} | AC: {monster.armor.ac} | HP:{' '}
                                                {monster.hp.average} ({monster.hp.hit_dice}) | CR:{' '}
                                                {monster.challenge.rating}
                                                {monster.spellcasting ? ' | Caster' : ''}
                                                {(monster.environments?.length ?? 0) > 0
                                                    ? ` | ${monster.environments!.join(', ')}`
                                                    : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openViewDialog(monster)}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openEditDialog(monster)}
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
                            <div className="flex items-center justify-between pt-2">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                                >
                                    Prev
                                </button>
                                <span className="text-sm">
                                    Page {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() =>
                                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                                    }
                                    disabled={currentPage === totalPages}
                                    className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    ))}

                {libraryTab === 'aurora' &&
                    (auroraLoading ? (
                        <p className="text-sm text-muted-foreground">Loading Aurora creatures…</p>
                    ) : !auroraAvailable ? (
                        <p className="text-sm text-muted-foreground">
                            Aurora catalog unavailable. Set AURORA_ELEMENTS_ROOT (run.sh does this
                            for local demo).
                        </p>
                    ) : auroraMonsters.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No Aurora companions/monsters matched. Official Aurora packs include
                            Companion beasts (PHB/MM familiars), not the full Monster Manual.
                        </p>
                    ) : filteredAuroraMonsters.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No Aurora creatures matched.</p>
                    ) : (
                        <div className="grid max-h-[55vh] gap-2 overflow-y-auto">
                            {filteredAuroraMonsters.map((creature) => (
                                <CardContent className="p-2" key={creature.id}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="truncate font-semibold">
                                                {creature.name}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {creature.size || '—'} | AC {creature.ac ?? '—'} |
                                                HP {creature.hp_average ?? '—'} | CR{' '}
                                                {creature.challenge ?? '—'}
                                                {creature.source ? ` | ${creature.source}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => void openAuroraView(creature)}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => void importAuroraToLocal(creature)}
                                            >
                                                Import
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            ))}
                        </div>
                    ))}

                {libraryTab === 'fc5' &&
                    (fc5Loading ? (
                        <p className="text-sm text-muted-foreground">Loading FC5 bestiary…</p>
                    ) : !fc5Available ? (
                        <p className="text-sm text-muted-foreground">
                            FC5 catalog unavailable. Set FC5_ROOT to your Fight Club 5e XML folder
                            (run.sh defaults to data/fc5).
                        </p>
                    ) : fc5Monsters.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No FC5 monsters matched. Drop Complete_Compendium_5e.xml (or Core/SRD)
                            under data/fc5 and search by name.
                        </p>
                    ) : filteredFc5Monsters.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No FC5 monsters matched.</p>
                    ) : (
                        <div className="grid max-h-[55vh] gap-2 overflow-y-auto">
                            {visibleFc5Monsters.map((creature) => (
                                <CardContent className="p-2" key={creature.id}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="truncate font-semibold">
                                                {creature.name}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {creature.size || '—'} | AC {creature.ac ?? '—'} |
                                                HP {creature.hp_average ?? '—'} | CR{' '}
                                                {creature.challenge ?? '—'}
                                                {creature.creature_type
                                                    ? ` | ${creature.creature_type}`
                                                    : ''}
                                                {creature.source ? ` | ${creature.source}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => void openFc5View(creature)}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => void importFc5ToLocal(creature)}
                                            >
                                                Import
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            ))}
                            <div className="flex items-center justify-between pt-2">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                                >
                                    Prev
                                </button>
                                <span className="text-sm">
                                    Page {currentPage} / {fc5TotalPages} (
                                    {filteredFc5Monsters.length}
                                    {fc5TotalCount ? ` / ${fc5TotalCount}` : ''})
                                </span>
                                <button
                                    onClick={() =>
                                        setCurrentPage((p) => Math.min(fc5TotalPages, p + 1))
                                    }
                                    disabled={currentPage === fc5TotalPages}
                                    className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    ))}
            </div>

            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto bg-white dark:bg-zinc-800">
                    <DialogHeader>
                        <DialogTitle>{viewMonster?.name}</DialogTitle>
                        <DialogDescription>Monster stat block</DialogDescription>
                    </DialogHeader>
                    {viewMonster && <MonsterStatBlock monster={viewMonster} />}
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateEditDialogOpen} onOpenChange={setIsCreateEditDialogOpen}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-white dark:bg-zinc-800">
                    <DialogHeader>
                        <DialogTitle>
                            {editingMonster ? 'Edit Monster' : 'Create Monster'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingMonster
                                ? 'Update monster information'
                                : 'Add a new monster to the system'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Size</Label>
                                <Select
                                    value={formData.size}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, size: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[
                                            'tiny',
                                            'small',
                                            'medium',
                                            'large',
                                            'huge',
                                            'gargantuan',
                                        ].map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Alignment</Label>
                                <Select
                                    value={formData.alignment}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, alignment: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[
                                            'lawful_good',
                                            'neutral_good',
                                            'chaotic_good',
                                            'lawful_neutral',
                                            'neutral',
                                            'chaotic_neutral',
                                            'lawful_evil',
                                            'neutral_evil',
                                            'chaotic_evil',
                                            'unaligned',
                                        ].map((a) => (
                                            <SelectItem key={a} value={a}>
                                                {a.replace(/_/g, ' ')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>AC</Label>
                                <Input
                                    type="number"
                                    value={formData.armor.ac}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            armor: {
                                                ...formData.armor,
                                                ac: Number(e.target.value) || 0,
                                            },
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Armor type</Label>
                                <Select
                                    value={formData.armor.type}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            armor: { ...formData.armor, type: value },
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[
                                            'padded',
                                            'leather',
                                            'studded_leather',
                                            'hide',
                                            'chain_shirt',
                                            'scale_mail',
                                            'breastplate',
                                            'half_plate',
                                            'ring_mail',
                                            'chain_mail',
                                            'splint',
                                            'plate',
                                            'natural_armor',
                                        ].map((t) => (
                                            <SelectItem key={t} value={t}>
                                                {t.replace(/_/g, ' ')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end gap-2 pb-2">
                                <Checkbox
                                    id="shield"
                                    checked={formData.armor.shield}
                                    onCheckedChange={(checked: boolean | 'indeterminate') =>
                                        setFormData({
                                            ...formData,
                                            armor: {
                                                ...formData.armor,
                                                shield: checked === true,
                                            },
                                        })
                                    }
                                />
                                <Label htmlFor="shield">Shield</Label>
                            </div>
                            <div className="space-y-1">
                                <Label>HP average</Label>
                                <Input
                                    type="number"
                                    value={formData.hp.average}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            hp: {
                                                ...formData.hp,
                                                average: Number(e.target.value) || 0,
                                            },
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Hit dice</Label>
                                <Input
                                    value={formData.hp.hit_dice}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            hp: { ...formData.hp, hit_dice: e.target.value },
                                        })
                                    }
                                />
                            </div>
                            {(['walk', 'fly', 'swim', 'climb', 'burrow'] as const).map((key) => (
                                <div className="space-y-1" key={key}>
                                    <Label>{key} speed</Label>
                                    <Input
                                        type="number"
                                        value={formData.speed[key] ?? ''}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                speed: {
                                                    ...formData.speed,
                                                    [key]:
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value) || 0,
                                                },
                                            })
                                        }
                                    />
                                </div>
                            ))}
                            <div className="space-y-1">
                                <Label>CR</Label>
                                <Input
                                    type="number"
                                    step="0.125"
                                    value={formData.challenge.rating}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            challenge: {
                                                ...formData.challenge,
                                                rating: parseFloat(e.target.value) || 0,
                                            },
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>XP</Label>
                                <Input
                                    type="number"
                                    value={formData.challenge.xp}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            challenge: {
                                                ...formData.challenge,
                                                xp: Number(e.target.value) || 0,
                                            },
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Environments</Label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {ENVIRONMENT_PRESETS.map((env) => {
                                        const id = `env-${env}`;
                                        const checked = (formData.environments ?? []).includes(
                                            env
                                        );
                                        return (
                                            <div key={env} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={id}
                                                    checked={checked}
                                                    onCheckedChange={(
                                                        value: boolean | 'indeterminate'
                                                    ) => toggleEnvironment(env, value === true)}
                                                />
                                                <Label htmlFor={id} className="font-normal">
                                                    {env}
                                                </Label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label>Passive Perception</Label>
                                <Input
                                    type="number"
                                    value={formData.senses?.passive_perception ?? 10}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            senses: {
                                                ...(formData.senses ?? {
                                                    passive_perception: 10,
                                                }),
                                                passive_perception: Number(e.target.value) || 0,
                                            },
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Darkvision (ft)</Label>
                                <Input
                                    type="number"
                                    value={formData.senses?.darkvision ?? ''}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            senses: {
                                                ...(formData.senses ?? {
                                                    passive_perception: 10,
                                                }),
                                                darkvision:
                                                    e.target.value === ''
                                                        ? undefined
                                                        : Number(e.target.value) || 0,
                                            },
                                        })
                                    }
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="mb-2 block">Ability scores</Label>
                            <div className="grid grid-cols-6 gap-2">
                                {(
                                    [
                                        'strength',
                                        'dexterity',
                                        'constitution',
                                        'intelligence',
                                        'wisdom',
                                        'charisma',
                                    ] as const
                                ).map((abil) => (
                                    <div key={abil} className="space-y-1">
                                        <Label className="text-xs uppercase">
                                            {abil.slice(0, 3)}
                                        </Label>
                                        <Input
                                            type="number"
                                            value={scores[abil]}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    ability_scores: {
                                                        ...scores,
                                                        [abil]: Number(e.target.value) || 0,
                                                    },
                                                })
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DescriptionListEditor
                            label="Traits"
                            items={formData.descriptions ?? []}
                            onChange={(descriptions) => setFormData({ ...formData, descriptions })}
                        />
                        <DescriptionListEditor
                            label="Actions"
                            items={formData.actions ?? []}
                            onChange={(actions) => setFormData({ ...formData, actions })}
                        />
                        <DescriptionListEditor
                            label="Reactions"
                            items={formData.reactions ?? []}
                            onChange={(reactions) => setFormData({ ...formData, reactions })}
                        />
                        <DescriptionListEditor
                            label="Legendary actions"
                            items={formData.legendary_actions ?? []}
                            onChange={(legendary_actions) =>
                                setFormData({ ...formData, legendary_actions })
                            }
                        />

                        <div className="space-y-3 rounded border border-zinc-200 p-3 dark:border-zinc-700">
                            <div className="flex items-center justify-between">
                                <Label className="text-base">Spellcasting</Label>
                                {formData.spellcasting ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 text-xs"
                                        onClick={() => updateSpellcasting(null)}
                                    >
                                        Remove
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => updateSpellcasting(emptySpellcasting())}
                                    >
                                        Enable
                                    </Button>
                                )}
                            </div>
                            {formData.spellcasting && (
                                <>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <Label>Ability</Label>
                                            <Select
                                                value={formData.spellcasting.ability ?? 'intelligence'}
                                                onValueChange={(value) =>
                                                    updateSpellcasting({ ability: value })
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[
                                                        'strength',
                                                        'dexterity',
                                                        'constitution',
                                                        'intelligence',
                                                        'wisdom',
                                                        'charisma',
                                                    ].map((a) => (
                                                        <SelectItem key={a} value={a}>
                                                            {a}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Save DC</Label>
                                            <Input
                                                type="number"
                                                value={formData.spellcasting.save_dc ?? ''}
                                                onChange={(e) =>
                                                    updateSpellcasting({
                                                        save_dc: Number(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Attack bonus</Label>
                                            <Input
                                                type="number"
                                                value={formData.spellcasting.attack_bonus ?? ''}
                                                onChange={(e) =>
                                                    updateSpellcasting({
                                                        attack_bonus: Number(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="mb-1 block text-xs">
                                            Spell slots (1st–9th)
                                        </Label>
                                        <div className="grid grid-cols-9 gap-1">
                                            {slots.map((n, i) => (
                                                <Input
                                                    key={`slot-${i}`}
                                                    type="number"
                                                    min={0}
                                                    className="h-8 px-1 text-center text-xs"
                                                    value={n}
                                                    onChange={(e) => {
                                                        const next = [...slots];
                                                        next[i] = Math.max(
                                                            0,
                                                            Number(e.target.value) || 0
                                                        );
                                                        updateSpellcasting({ slots: next });
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <SpellCatalogPicker
                                        available={catalogAvailable}
                                        onPick={(entry) => {
                                            const spells = [
                                                ...(formData.spellcasting?.spells ?? []),
                                                {
                                                    name: entry.name,
                                                    level: entry.level,
                                                    usage: 'slot' as const,
                                                    source: 'aurora',
                                                    external_id: entry.id,
                                                },
                                            ];
                                            updateSpellcasting({ spells });
                                        }}
                                    />
                                    <div className="flex items-center justify-between">
                                        <Label>Spells</Label>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs"
                                            onClick={() =>
                                                updateSpellcasting({
                                                    spells: [
                                                        ...(formData.spellcasting?.spells ?? []),
                                                        {
                                                            name: '',
                                                            level: 1,
                                                            usage: 'slot',
                                                        },
                                                    ],
                                                })
                                            }
                                        >
                                            Add spell
                                        </Button>
                                    </div>
                                    {(formData.spellcasting.spells ?? []).map((sp, index) => (
                                        <div
                                            key={`spell-${index}`}
                                            className="space-y-1 rounded border border-zinc-200 p-2 dark:border-zinc-700"
                                        >
                                            <div className="grid grid-cols-3 gap-2">
                                                <Input
                                                    placeholder="Name"
                                                    value={sp.name}
                                                    onChange={(e) =>
                                                        updateSpell(index, {
                                                            name: e.target.value,
                                                        })
                                                    }
                                                />
                                                <Input
                                                    type="number"
                                                    placeholder="Level"
                                                    value={sp.level}
                                                    onChange={(e) =>
                                                        updateSpell(index, {
                                                            level: Number(e.target.value) || 0,
                                                        })
                                                    }
                                                />
                                                <Select
                                                    value={sp.usage ?? 'slot'}
                                                    onValueChange={(value) =>
                                                        updateSpell(index, {
                                                            usage: value as MonsterSpell['usage'],
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="slot">Slot</SelectItem>
                                                        <SelectItem value="at_will">
                                                            At will
                                                        </SelectItem>
                                                        <SelectItem value="per_day">
                                                            Per day
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {sp.usage === 'per_day' && (
                                                <Input
                                                    type="number"
                                                    placeholder="Uses per day"
                                                    value={sp.per_day ?? 1}
                                                    onChange={(e) =>
                                                        updateSpell(index, {
                                                            per_day: Number(e.target.value) || 1,
                                                        })
                                                    }
                                                />
                                            )}
                                            <Input
                                                placeholder="Notes (range, save, effect — DM authored)"
                                                value={sp.notes ?? ''}
                                                onChange={(e) =>
                                                    updateSpell(index, {
                                                        notes: e.target.value,
                                                    })
                                                }
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="destructive"
                                                className="h-7 text-xs"
                                                onClick={() =>
                                                    updateSpellcasting({
                                                        spells: (
                                                            formData.spellcasting?.spells ?? []
                                                        ).filter((_, i) => i !== index),
                                                    })
                                                }
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        <div className="flex justify-end space-x-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsCreateEditDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleCreateUpdateSubmit}>
                                {editingMonster ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
