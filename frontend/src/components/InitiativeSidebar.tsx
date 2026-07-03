import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';
import { Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Skull, X, ChevronRight, ScrollText, MapPin, MapPinOff, Pencil, Crosshair } from 'lucide-react';
import { EncounterHistoryEntry, InitiativeEntry } from '../types/map';
import { applyTurnChangeToEntries } from '@/utils/turnMovementTrail';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { cn } from '../lib/utils';
import { GlassPanel } from './gameboard/GlassPanel';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import {
    isDiceExpression,
    parseInitiativeModifier,
    resolveHP,
    resolveInitiative,
    rollDiceExpression,
    rollInitiative,
} from '../utils/dice';

function createEntryId(): string {
    return crypto.randomUUID();
}

function createInitiativeEntry(
    name: string,
    initiative: number,
    isPlayer: boolean,
    hp?: number
): InitiativeEntry {
    return {
        id: createEntryId(),
        name,
        initiative,
        isPlayer,
        isCurrentTurn: false,
        hp,
        initialHP: hp,
        isKilled: false,
    };
}

function createHistoryEntry(text: string): EncounterHistoryEntry {
    return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        text,
    };
}

function formatHistoryTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

interface EncounterUpdate {
    entries?: InitiativeEntry[];
    encounterHistory?: EncounterHistoryEntry[];
}

interface InitiativeSidebarProps {
    isAdmin: boolean;
    entries: InitiativeEntry[];
    encounterHistory: EncounterHistoryEntry[];
    onEncounterUpdate: (update: EncounterUpdate) => void;
    showCurrentPlayer: boolean;
    onToggleCurrentPlayer: () => void;
    onClose: () => void;
    placingEntryId?: string | null;
    onStartPlaceEntry?: (id: string) => void;
    onClearEntryPosition?: (id: string) => void;
    onLocateEntry?: (id: string) => void;
}

export const InitiativeSidebar: React.FC<InitiativeSidebarProps> = ({
    isAdmin,
    entries = [],
    encounterHistory = [],
    onEncounterUpdate,
    showCurrentPlayer,
    onToggleCurrentPlayer,
    onClose,
    placingEntryId = null,
    onStartPlaceEntry,
    onClearEntryPosition,
    onLocateEntry,
}) => {
    const { toast } = useToast();
    const [isVisible, setIsVisible] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [playerName, setPlayerName] = useState('');
    const [playerInitiative, setPlayerInitiative] = useState('');
    const [enemyName, setEnemyName] = useState('');
    const [enemyInitiative, setEnemyInitiative] = useState('');
    const [enemyHP, setEnemyHP] = useState('');
    const [enemyCount, setEnemyCount] = useState('');
    const [bulkEnemyName, setBulkEnemyName] = useState('');
    const [bulkEnemyHP, setBulkEnemyHP] = useState('');
    const [bulkEnemyInitMod, setBulkEnemyInitMod] = useState('');
    const [playerNames, setPlayerNames] = useState<string[]>([]);
    const [entryContextMenu, setEntryContextMenu] = useState<{
        entryId: string;
        x: number;
        y: number;
    } | null>(null);
    const [editEntryId, setEditEntryId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editInitiative, setEditInitiative] = useState('');
    const [editHP, setEditHP] = useState('');
    const [editInitialHP, setEditInitialHP] = useState('');
    const playerNameRef = useRef<HTMLInputElement>(null);
    const enemyNameRef = useRef<HTMLInputElement>(null);
    const bulkEnemyNameRef = useRef<HTMLInputElement>(null);
    const editNameRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (!entryContextMenu) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (e.button === 2) return;
            const target = e.target as Node;
            if (
                target instanceof Element &&
                target.closest('[data-initiative-context-menu]')
            ) {
                return;
            }
            setEntryContextMenu(null);
        };

        const handleScroll = () => setEntryContextMenu(null);
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setEntryContextMenu(null);
        };

        const timerId = window.setTimeout(() => {
            document.addEventListener('pointerdown', handlePointerDown, true);
            document.addEventListener('scroll', handleScroll, true);
            document.addEventListener('keydown', handleKeyDown);
        }, 0);

        return () => {
            window.clearTimeout(timerId);
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('scroll', handleScroll, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [entryContextMenu]);

    useEffect(() => {
        if (editEntryId && editNameRef.current) {
            editNameRef.current.focus();
            editNameRef.current.select();
        }
    }, [editEntryId]);

    const openEntryContextMenu = useCallback(
        (entryId: string, clientX: number, clientY: number) => {
            if (!isAdmin) return;
            setEntryContextMenu({ entryId, x: clientX, y: clientY });
        },
        [isAdmin]
    );

    const openEditDialog = useCallback(
        (entryId: string) => {
            const entry = entries.find((e) => e.id === entryId);
            if (!entry) return;

            setEditEntryId(entryId);
            setEditName(entry.name);
            setEditInitiative(String(entry.initiative));
            setEditHP(entry.hp !== undefined ? String(entry.hp) : '');
            setEditInitialHP(
                entry.initialHP !== undefined
                    ? String(entry.initialHP)
                    : entry.hp !== undefined
                      ? String(entry.hp)
                      : ''
            );
            setEntryContextMenu(null);
        },
        [entries]
    );

    const closeEditDialog = () => {
        setEditEntryId(null);
        setEditName('');
        setEditInitiative('');
        setEditHP('');
        setEditInitialHP('');
    };

    const saveEditedEntry = () => {
        const entry = entries.find((e) => e.id === editEntryId);
        if (!entry) return;

        const name = editName.trim();
        if (!name) {
            toast({
                title: 'Error',
                description: 'Name is required',
                variant: 'destructive',
            });
            return;
        }

        const initiative = parseInt(editInitiative, 10);
        if (Number.isNaN(initiative)) {
            toast({
                title: 'Error',
                description: 'Initiative must be a number',
                variant: 'destructive',
            });
            return;
        }

        let hp = entry.hp;
        let initialHP = entry.initialHP;

        if (!entry.isPlayer) {
            const hpTrimmed = editHP.trim();
            const maxTrimmed = editInitialHP.trim();

            if (hpTrimmed || maxTrimmed) {
                if (hpTrimmed) {
                    const parsedHP = parseInt(hpTrimmed, 10);
                    if (Number.isNaN(parsedHP)) {
                        toast({
                            title: 'Error',
                            description: 'Current HP must be a number',
                            variant: 'destructive',
                        });
                        return;
                    }
                    hp = parsedHP;
                }

                if (maxTrimmed) {
                    const parsedMax = parseInt(maxTrimmed, 10);
                    if (Number.isNaN(parsedMax)) {
                        toast({
                            title: 'Error',
                            description: 'Max HP must be a number',
                            variant: 'destructive',
                        });
                        return;
                    }
                    initialHP = parsedMax;
                } else if (hpTrimmed) {
                    initialHP = hp;
                }
            } else {
                hp = undefined;
                initialHP = undefined;
            }
        }

        const updatedEntry: InitiativeEntry = {
            ...entry,
            name,
            initiative,
            ...(entry.isPlayer ? {} : { hp, initialHP }),
        };

        const newEntries = entries
            .map((e) => (e.id === entry.id ? updatedEntry : e))
            .sort((a, b) => b.initiative - a.initiative);

        const changes: string[] = [];
        if (entry.name !== name) changes.push(`name → ${name}`);
        if (entry.initiative !== initiative) changes.push(`init → ${initiative}`);
        if (!entry.isPlayer && entry.hp !== hp) {
            changes.push(`HP → ${hp ?? '—'}`);
        }
        if (!entry.isPlayer && entry.initialHP !== initialHP) {
            changes.push(`max HP → ${initialHP ?? '—'}`);
        }

        const logSuffix = changes.length > 0 ? ` (${changes.join(', ')})` : '';
        updateWithLog(newEntries, `Edited ${entry.name}${logSuffix}`);

        if (entry.isPlayer && !playerNames.includes(name)) {
            setPlayerNames((prev) => [...prev, name]);
        }

        closeEditDialog();
    };

    const pushEncounterUpdate = (update: EncounterUpdate) => {
        onEncounterUpdate(update);
    };

    const updateWithLog = (newEntries: InitiativeEntry[], text: string) => {
        pushEncounterUpdate({
            entries: newEntries,
            encounterHistory: [createHistoryEntry(text), ...encounterHistory],
        });
    };

    const getAliveEntries = () => entries.filter(entry => !entry.isKilled);

    const getTurnName = (entryList: InitiativeEntry[]) => {
        const alive = entryList.filter(entry => !entry.isKilled);
        const current = alive.find(entry => entry.isCurrentTurn) ?? alive[0];
        return current?.name;
    };

    const addEntry = (name: string, initiative: number, isPlayer: boolean, hp?: number, logText?: string) => {
        const newEntry = createInitiativeEntry(name, initiative, isPlayer, hp);

        const newEntries = [...entries, newEntry].sort((a, b) => b.initiative - a.initiative);
        if (logText) {
            updateWithLog(newEntries, logText);
        } else {
            pushEncounterUpdate({ entries: newEntries });
        }

        if (isPlayer && !playerNames.includes(name)) {
            setPlayerNames(prev => [...prev, name]);
        }

        setPlayerName('');
        setPlayerInitiative('');
        setEnemyName('');
        setEnemyInitiative('');
        setEnemyHP('');
    };

    const removeEntry = (id: string) => {
        const entry = entries.find(e => e.id === id);
        if (!entry) return;

        const newEntries = entries.filter(entry => entry.id !== id);
        updateWithLog(newEntries, `Removed ${entry.name}`);
    };

    const killEntry = (id: string) => {
        const killedEntry = entries.find(e => e.id === id);
        if (!killedEntry) return;

        // If the entry was the current turn, move to the next alive entry first
        if (killedEntry.isCurrentTurn) {
            const aliveEntries = entries.filter(entry => !entry.isKilled);
            if (aliveEntries.length > 0) {
                const currentIndex = aliveEntries.findIndex(entry => entry.id === id);
                const nextIndex = (currentIndex + 1) % aliveEntries.length;
                const newCurrentId = aliveEntries[nextIndex].id;

                let finalEntries = applyTurnChangeToEntries(entries, newCurrentId);
                finalEntries = finalEntries.map((entry) =>
                    entry.id === id
                        ? {
                              ...entry,
                              isKilled: true,
                              isCurrentTurn: false,
                              turnMovementPath: undefined,
                          }
                        : entry
                );

                updateWithLog(finalEntries, `Killed ${killedEntry.name}`);
                return;
            }
        }

        // If not current turn, just mark as killed
        const newEntries = entries.map(entry =>
            entry.id === id ? { ...entry, isKilled: true, isCurrentTurn: false } : entry
        );
        updateWithLog(newEntries, `Killed ${killedEntry.name}`);
    };

    const reviveEntry = (id: string) => {
        const entry = entries.find(e => e.id === id);
        if (!entry) return;

        const newEntries = entries.map(entry =>
            entry.id === id ? { ...entry, isKilled: false, hp: 1 } : entry
        );
        updateWithLog(newEntries, `Revived ${entry.name} (1 HP)`);
    };

    const clearKilledEntries = () => {
        const killedCount = entries.filter(entry => entry.isKilled).length;
        if (killedCount === 0) return;

        const newEntries = entries.filter(entry => !entry.isKilled);
        updateWithLog(newEntries, `Cleared ${killedCount} killed ${killedCount === 1 ? 'entry' : 'entries'}`);
    };


    const adjustHP = (id: string, adjustment: string) => {
        const entry = entries.find(e => e.id === id);
        if (!entry || entry.hp === undefined) return;

        const currentHP = entry.hp;
        const adjustmentValue = parseInt(adjustment);
        if (isNaN(adjustmentValue)) return;

        const newHP = currentHP + adjustmentValue;
        const finalHP = newHP <= 0 ? newHP : Math.max(0, newHP);
        const deltaLabel = adjustmentValue >= 0 ? `+${adjustmentValue}` : `${adjustmentValue}`;

        // Update HP first
        const newEntries = entries.map(entry =>
            entry.id === id ? { ...entry, hp: finalHP } : entry
        );

        // Then kill if needed
        if (newHP <= 0) {
            const logText = `${entry.name} HP ${deltaLabel} → ${finalHP}, killed`;

            // If the entry was the current turn, move to the next alive entry first
            if (entry.isCurrentTurn) {
                const aliveEntries = entries.filter(entry => !entry.isKilled);
                if (aliveEntries.length > 0) {
                    const currentIndex = aliveEntries.findIndex(e => e.id === id);
                    const nextIndex = (currentIndex + 1) % aliveEntries.length;
                    const newCurrentId = aliveEntries[nextIndex].id;

                    let finalEntries = applyTurnChangeToEntries(newEntries, newCurrentId);
                    finalEntries = finalEntries.map((entry) =>
                        entry.id === id
                            ? {
                                  ...entry,
                                  isKilled: true,
                                  isCurrentTurn: false,
                                  turnMovementPath: undefined,
                              }
                            : entry
                    );

                    updateWithLog(finalEntries, logText);
                    return;
                }
            }

            // If not current turn, just mark as killed
            const killedEntries = newEntries.map(entry =>
                entry.id === id ? { ...entry, isKilled: true, isCurrentTurn: false } : entry
            );
            updateWithLog(killedEntries, logText);
            return;
        }

        updateWithLog(newEntries, `${entry.name} HP ${deltaLabel} → ${finalHP}`);
    };

    const moveToNextTurn = () => {
        if (entries.length === 0) return;

        const aliveEntries = getAliveEntries();
        if (aliveEntries.length === 0) return;

        const fromName = getTurnName(entries);
        const currentIndex = aliveEntries.findIndex(entry => entry.isCurrentTurn);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % aliveEntries.length;
        const toName = aliveEntries[nextIndex]?.name;

        const newEntries = applyTurnChangeToEntries(
            entries,
            aliveEntries[nextIndex].id
        );

        if (fromName && toName && fromName !== toName) {
            updateWithLog(newEntries, `Turn: ${fromName} → ${toName}`);
        } else {
            pushEncounterUpdate({ entries: newEntries });
        }
    };

    const moveToPreviousTurn = () => {
        if (entries.length === 0) return;

        const aliveEntries = getAliveEntries();
        if (aliveEntries.length === 0) return;

        const fromName = getTurnName(entries);
        const currentIndex = aliveEntries.findIndex(entry => entry.isCurrentTurn);
        const prevIndex = currentIndex === -1 ? aliveEntries.length - 1 : (currentIndex - 1 + aliveEntries.length) % aliveEntries.length;
        const toName = aliveEntries[prevIndex]?.name;

        const newEntries = applyTurnChangeToEntries(
            entries,
            aliveEntries[prevIndex].id
        );

        if (fromName && toName && fromName !== toName) {
            updateWithLog(newEntries, `Turn: ${fromName} → ${toName}`);
        } else {
            pushEncounterUpdate({ entries: newEntries });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = entries.findIndex((entry) => entry.id === active.id);
            const newIndex = entries.findIndex((entry) => entry.id === over.id);

            const newEntries = arrayMove(entries, oldIndex, newIndex);
            updateWithLog(newEntries, 'Reordered initiative');
        }
    };

    const clearEncounterHistory = () => {
        pushEncounterUpdate({ encounterHistory: [] });
    };

    const resetEncounter = () => {
        if (!window.confirm('Clear all initiative entries and history? This cannot be undone.')) {
            return;
        }

        pushEncounterUpdate({ entries: [], encounterHistory: [] });
        setHistoryDialogOpen(false);
    };

    const addPlayerEntry = () => {
        if (!playerName || !playerInitiative) {
            toast({
                title: "Error",
                description: "Please enter both name and initiative",
                variant: "destructive",
            });
            return;
        }
        addEntry(
            playerName,
            parseInt(playerInitiative),
            true,
            undefined,
            `Added player ${playerName} (init ${parseInt(playerInitiative)})`
        );
        setPlayerName('');
        setPlayerInitiative('');
        playerNameRef.current?.focus();
    };

    const addEnemyEntry = () => {
        if (!enemyName || !enemyInitiative) {
            toast({
                title: "Error",
                description: "Please enter both name and initiative",
                variant: "destructive",
            });
            return;
        }

        const initInput = enemyInitiative.trim();
        const hpInput = enemyHP.trim();
        const initRolled = /^[+-]/.test(initInput);
        const hpRolled = hpInput !== '' && isDiceExpression(hpInput);

        let initiative: number;
        let hp: number | undefined;

        try {
            initiative = resolveInitiative(enemyInitiative);
            hp = resolveHP(enemyHP);
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Invalid HP or initiative value',
                variant: 'destructive',
            });
            return;
        }

        const initLabel = initRolled ? `init ${initiative} from ${initInput}` : `init ${initiative}`;
        const hpLabel =
            hp === undefined
                ? ''
                : hpRolled
                  ? `, HP ${hp} from ${hpInput}`
                  : `, HP ${hp}`;

        addEntry(
            enemyName,
            initiative,
            false,
            hp,
            `Added enemy ${enemyName} (${initLabel}${hpLabel})`
        );
        setEnemyName('');
        setEnemyInitiative('');
        setEnemyHP('');
        enemyNameRef.current?.focus();
    };

    const addBulkEnemyEntries = () => {
        const count = parseInt(enemyCount, 10);
        const baseName = bulkEnemyName.trim();

        if (!baseName || !enemyCount || Number.isNaN(count) || count < 1) {
            toast({
                title: 'Error',
                description: 'Please enter a count (≥ 1) and enemy name',
                variant: 'destructive',
            });
            return;
        }

        if (!bulkEnemyHP.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter an HP dice expression (e.g. 5d6+6)',
                variant: 'destructive',
            });
            return;
        }

        let initiativeModifier: number;
        try {
            initiativeModifier = parseInitiativeModifier(bulkEnemyInitMod);
        } catch {
            toast({
                title: 'Error',
                description: 'Please enter a valid initiative modifier (e.g. +3)',
                variant: 'destructive',
            });
            return;
        }

        const rolledHP: number[] = [];
        const rolledInit: number[] = [];
        const newEntries: InitiativeEntry[] = [];

        try {
            for (let i = 0; i < count; i++) {
                const hp = rollDiceExpression(bulkEnemyHP);
                const initiative = rollInitiative(initiativeModifier);
                rolledHP.push(hp);
                rolledInit.push(initiative);
                newEntries.push(
                    createInitiativeEntry(`${baseName}_${i + 1}`, initiative, false, hp)
                );
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Invalid HP dice expression',
                variant: 'destructive',
            });
            return;
        }

        const sortedEntries = [...entries, ...newEntries].sort((a, b) => b.initiative - a.initiative);
        const logText = `Added ${count} ${baseName}${count === 1 ? '' : 's'} — HP: ${rolledHP.join(', ')} | Init: ${rolledInit.join(', ')}`;
        updateWithLog(sortedEntries, logText);

        toast({
            title: `Added ${count} ${baseName}${count === 1 ? '' : 's'}`,
            description: `HP: ${rolledHP.join(', ')} | Init: ${rolledInit.join(', ')}`,
        });

        setEnemyCount('');
        setBulkEnemyName('');
        setBulkEnemyHP('');
        setBulkEnemyInitMod('');
        bulkEnemyNameRef.current?.focus();
    };

    return (
        <>
            {!isVisible && (
                <Button
                    variant="outline"
                    size="sm"
                    className="fixed bottom-0 left-0 m-4"
                    onClick={() => setIsVisible(true)}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            )}
            {isVisible && (
                <GlassPanel
                    title="Initiative"
                    edge="bottom-left"
                    className="!w-[30rem] max-w-[95vw]"
                    onClose={onClose}
                    headerActions={
                        <>
                            {isAdmin && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setHistoryDialogOpen(true)}
                                    title="Encounter history"
                                >
                                    <ScrollText className="h-4 w-4" />
                                </Button>
                            )}
                            {isAdmin && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setAddDialogOpen(true)}
                                    title="Add player or enemy"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={moveToPreviousTurn}
                                title="Previous turn"
                            >
                                <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={moveToNextTurn}
                                title="Next turn"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={onToggleCurrentPlayer}
                                title={
                                    showCurrentPlayer
                                        ? 'Hide current player indicator'
                                        : 'Show current player indicator'
                                }
                            >
                                {showCurrentPlayer ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </Button>
                        </>
                    }
                    footer={
                        isAdmin && entries.some((entry) => entry.isKilled) ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={clearKilledEntries}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Clear Killed Entries
                            </Button>
                        ) : undefined
                    }
                >
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={entries.map(entry => entry.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {entries.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className={cn(
                                            'flex min-h-9 flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md border-l-2 p-2 transition-colors',
                                            entry.isCurrentTurn
                                                ? 'border-primary bg-accent/20'
                                                : 'border-transparent hover:bg-accent/10',
                                            entry.isPlayer ? 'text-foreground' : 'text-foreground',
                                            entry.isKilled && 'opacity-50',
                                            placingEntryId === entry.id && 'ring-1 ring-primary',
                                            isAdmin && 'cursor-context-menu'
                                        )}
                                        onContextMenu={(e) => {
                                            if (!isAdmin) return;
                                            e.preventDefault();
                                            openEntryContextMenu(entry.id, e.clientX, e.clientY);
                                        }}
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                            {entry.isCurrentTurn && (
                                                <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                                            )}
                                            <span
                                                className={cn(
                                                    'truncate text-sm font-medium',
                                                    !entry.isPlayer && 'text-red-200'
                                                )}
                                            >
                                                {entry.name}
                                            </span>
                                        </div>
                                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                            {!entry.isPlayer && entry.hp !== undefined && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="rounded-md border border-red-500/50 bg-red-950/70 px-2 py-0.5 text-sm font-semibold tabular-nums text-red-50">
                                                        {entry.isKilled && entry.hp < 0 ? entry.hp : entry.hp}
                                                        <span className="text-red-300/90">/{entry.initialHP}</span>
                                                    </span>
                                                    <Input
                                                        type="text"
                                                        placeholder="±HP"
                                                        className="h-7 w-14 border-red-500/30 bg-red-950/40 text-xs text-red-50 placeholder:text-red-300/50"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                adjustHP(entry.id, e.currentTarget.value);
                                                                e.currentTarget.value = '';
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <span className="font-mono text-xs text-muted-foreground">
                                                {entry.initiative}
                                            </span>
                                            {isAdmin && onStartPlaceEntry && onClearEntryPosition && (
                                                <div className="flex items-center gap-0.5">
                                                    {entry.mapPosition ? (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 text-muted-foreground"
                                                                title="Remove from map"
                                                                onClick={() => onClearEntryPosition(entry.id)}
                                                            >
                                                                <MapPinOff className="h-3.5 w-3.5" />
                                                            </Button>
                                                            {!entry.isKilled && onLocateEntry && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 text-muted-foreground"
                                                                    title="Locate on map"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onLocateEntry(entry.id);
                                                                    }}
                                                                >
                                                                    <Crosshair className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        !entry.isKilled && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0"
                                                                title="Place on map"
                                                                onClick={() => onStartPlaceEntry(entry.id)}
                                                            >
                                                                <MapPin className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                            {isAdmin && (
                                                <div className="flex gap-1">
                                                    {entry.isKilled ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => reviveEntry(entry.id)}
                                                            className="text-emerald-500 hover:text-emerald-400"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => killEntry(entry.id)}
                                                            className="text-red-500 hover:text-red-400"
                                                        >
                                                            <Skull className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeEntry(entry.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </SortableContext>
                        </DndContext>
                </GlassPanel>
            )}

            {isAdmin && (
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add to Initiative</DialogTitle>
                            <DialogDescription>
                                Add a player, single enemy, or multiple enemies with rolled HP and initiative.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Player</Label>
                                <div className="flex gap-2">
                                    <Input
                                        ref={playerNameRef}
                                        type="text"
                                        placeholder="Player name"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        list="playerNames"
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Init"
                                        value={playerInitiative}
                                        onChange={(e) => setPlayerInitiative(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                addPlayerEntry();
                                            }
                                        }}
                                        className="w-20"
                                    />
                                    <Button onClick={addPlayerEntry} size="icon" variant="outline">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                <datalist id="playerNames">
                                    {playerNames.map(name => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="h-px bg-border" />

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Enemy</Label>
                                <div className="flex gap-2">
                                    <Input
                                        ref={enemyNameRef}
                                        type="text"
                                        placeholder="Enemy name"
                                        value={enemyName}
                                        onChange={(e) => setEnemyName(e.target.value)}
                                        className="flex-1"
                                    />
                                    <Input
                                        type="text"
                                        placeholder="HP / 5d6+6"
                                        value={enemyHP}
                                        onChange={(e) => setEnemyHP(e.target.value)}
                                        className="w-24"
                                    />
                                    <Input
                                        type="text"
                                        placeholder="Init / +3"
                                        value={enemyInitiative}
                                        onChange={(e) => setEnemyInitiative(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                addEnemyEntry();
                                            }
                                        }}
                                        className="w-24"
                                    />
                                    <Button onClick={addEnemyEntry} size="icon" variant="outline">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="h-px bg-border" />

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                    Bulk enemies (rolled HP &amp; initiative)
                                </Label>
                                <div className="grid grid-cols-[4rem_1fr] gap-2">
                                    <Input
                                        type="number"
                                        placeholder="#"
                                        title="Count"
                                        min={1}
                                        value={enemyCount}
                                        onChange={(e) => setEnemyCount(e.target.value)}
                                    />
                                    <Input
                                        ref={bulkEnemyNameRef}
                                        type="text"
                                        placeholder="Base name (e.g. Goblin → Goblin_1, Goblin_2…)"
                                        value={bulkEnemyName}
                                        onChange={(e) => setBulkEnemyName(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        placeholder="HP dice (5d6+6)"
                                        value={bulkEnemyHP}
                                        onChange={(e) => setBulkEnemyHP(e.target.value)}
                                        className="flex-1"
                                    />
                                    <Input
                                        type="text"
                                        placeholder="Init (+3)"
                                        value={bulkEnemyInitMod}
                                        onChange={(e) => setBulkEnemyInitMod(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                addBulkEnemyEntries();
                                            }
                                        }}
                                        className="w-24"
                                    />
                                    <Button
                                        onClick={addBulkEnemyEntries}
                                        size="icon"
                                        variant="outline"
                                        title="Add multiple enemies with rolled HP and initiative"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {isAdmin &&
                entryContextMenu &&
                createPortal(
                    <div
                        data-initiative-context-menu
                        role="menu"
                        className="fixed z-[10002] min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
                        style={{
                            left: entryContextMenu.x,
                            top: entryContextMenu.y,
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                            onClick={() => openEditDialog(entryContextMenu.entryId)}
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                        </button>
                    </div>,
                    document.body
                )}

            {isAdmin && (
                <Dialog
                    open={editEntryId !== null}
                    onOpenChange={(open) => {
                        if (!open) closeEditDialog();
                    }}
                >
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit entry</DialogTitle>
                            <DialogDescription>
                                Update name, initiative, and HP for this combatant.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Name</Label>
                                <Input
                                    ref={editNameRef}
                                    id="edit-name"
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEditedEntry();
                                    }}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-initiative">Initiative</Label>
                                <Input
                                    id="edit-initiative"
                                    type="number"
                                    value={editInitiative}
                                    onChange={(e) => setEditInitiative(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEditedEntry();
                                    }}
                                />
                            </div>

                            {editEntryId &&
                                !entries.find((e) => e.id === editEntryId)?.isPlayer && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-hp">Current HP</Label>
                                            <Input
                                                id="edit-hp"
                                                type="number"
                                                placeholder="Optional"
                                                value={editHP}
                                                onChange={(e) => setEditHP(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEditedEntry();
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-max-hp">Max HP</Label>
                                            <Input
                                                id="edit-max-hp"
                                                type="number"
                                                placeholder="Optional"
                                                value={editInitialHP}
                                                onChange={(e) => setEditInitialHP(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEditedEntry();
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={closeEditDialog}>
                                Cancel
                            </Button>
                            <Button onClick={saveEditedEntry}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {isAdmin && (
                <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Encounter history</DialogTitle>
                            <DialogDescription>
                                Actions during this encounter. Saved with the scene.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                            {encounterHistory.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    No events yet
                                </p>
                            ) : (
                                encounterHistory.map((event) => (
                                    <div
                                        key={event.id}
                                        className="flex gap-3 rounded-md border border-border/50 px-3 py-2 text-sm"
                                    >
                                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                            {formatHistoryTime(event.timestamp)}
                                        </span>
                                        <span className="min-w-0">{event.text}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                variant="outline"
                                onClick={clearEncounterHistory}
                                disabled={encounterHistory.length === 0}
                            >
                                Clear log
                            </Button>
                            <Button variant="destructive" onClick={resetEncounter}>
                                Reset encounter
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}; 