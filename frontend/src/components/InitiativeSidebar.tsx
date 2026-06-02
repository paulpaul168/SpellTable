import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';
import { Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Skull, X, ChevronRight, ScrollText } from 'lucide-react';
import { EncounterHistoryEntry, InitiativeEntry } from '../types/map';
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
    parseInitiativeModifier,
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
}

export const InitiativeSidebar: React.FC<InitiativeSidebarProps> = ({
    isAdmin,
    entries = [],
    encounterHistory = [],
    onEncounterUpdate,
    showCurrentPlayer,
    onToggleCurrentPlayer,
    onClose
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
    const playerNameRef = useRef<HTMLInputElement>(null);
    const enemyNameRef = useRef<HTMLInputElement>(null);
    const bulkEnemyNameRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

                // First update the current turn
                const updatedEntries = entries.map((entry) => ({
                    ...entry,
                    isCurrentTurn: !entry.isKilled && entry.id === aliveEntries[nextIndex].id
                }));

                // Then mark as killed
                const finalEntries = updatedEntries.map(entry =>
                    entry.id === id ? { ...entry, isKilled: true, isCurrentTurn: false } : entry
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

                    // First update the current turn
                    const updatedEntries = newEntries.map((entry) => ({
                        ...entry,
                        isCurrentTurn: !entry.isKilled && entry.id === aliveEntries[nextIndex].id
                    }));

                    // Then mark as killed
                    const finalEntries = updatedEntries.map(entry =>
                        entry.id === id ? { ...entry, isKilled: true, isCurrentTurn: false } : entry
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

        const newEntries = entries.map((entry) => ({
            ...entry,
            isCurrentTurn: !entry.isKilled && entry.id === aliveEntries[nextIndex].id
        }));

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

        const newEntries = entries.map((entry) => ({
            ...entry,
            isCurrentTurn: !entry.isKilled && entry.id === aliveEntries[prevIndex].id
        }));

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
        const initiative = parseInt(enemyInitiative);
        const hp = enemyHP ? parseInt(enemyHP) : undefined;
        const hpLabel = hp !== undefined ? `, HP ${hp}` : '';
        addEntry(
            enemyName,
            initiative,
            false,
            hp,
            `Added enemy ${enemyName} (init ${initiative}${hpLabel})`
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
                                            'flex min-h-9 items-center justify-between rounded-md border-l-2 p-2 transition-colors',
                                            entry.isCurrentTurn
                                                ? 'border-primary bg-accent/20'
                                                : 'border-transparent hover:bg-accent/10',
                                            entry.isPlayer ? 'text-foreground' : 'text-destructive',
                                            entry.isKilled && 'opacity-50'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            {entry.isCurrentTurn && (
                                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                            )}
                                            <span className="text-sm font-medium">
                                                {entry.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!entry.isPlayer && entry.hp !== undefined && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-sm font-mono w-16 text-right">
                                                        {entry.isKilled && entry.hp < 0 ? entry.hp : entry.hp}/{entry.initialHP}
                                                    </span>
                                                    <Input
                                                        type="text"
                                                        placeholder="±HP"
                                                        className="w-12 h-6 text-[10px]"
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
                                        type="number"
                                        placeholder="HP"
                                        value={enemyHP}
                                        onChange={(e) => setEnemyHP(e.target.value)}
                                        className="w-20"
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Init"
                                        value={enemyInitiative}
                                        onChange={(e) => setEnemyInitiative(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                addEnemyEntry();
                                            }
                                        }}
                                        className="w-20"
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