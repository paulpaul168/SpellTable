import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';
import { Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Skull, X, ChevronRight } from 'lucide-react';
import { InitiativeEntry } from '../types/map';
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

interface InitiativeSidebarProps {
    isAdmin: boolean;
    entries: InitiativeEntry[];
    onUpdate: (entries: InitiativeEntry[]) => void;
    showCurrentPlayer: boolean;
    onToggleCurrentPlayer: () => void;
    onClose: () => void;
}

export const InitiativeSidebar: React.FC<InitiativeSidebarProps> = ({
    isAdmin,
    entries = [],
    onUpdate,
    showCurrentPlayer,
    onToggleCurrentPlayer,
    onClose
}) => {
    const { toast } = useToast();
    const [isVisible, setIsVisible] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
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

    const addEntry = (name: string, initiative: number, isPlayer: boolean, hp?: number) => {
        const newEntry = createInitiativeEntry(name, initiative, isPlayer, hp);

        const newEntries = [...entries, newEntry].sort((a, b) => b.initiative - a.initiative);
        onUpdate(newEntries);

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
        const newEntries = entries.filter(entry => entry.id !== id);
        onUpdate(newEntries);
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

                onUpdate(finalEntries);
                return;
            }
        }

        // If not current turn, just mark as killed
        const newEntries = entries.map(entry =>
            entry.id === id ? { ...entry, isKilled: true, isCurrentTurn: false } : entry
        );
        onUpdate(newEntries);
    };

    const reviveEntry = (id: string) => {
        const newEntries = entries.map(entry =>
            entry.id === id ? { ...entry, isKilled: false, hp: 1 } : entry
        );
        onUpdate(newEntries);
    };

    const clearKilledEntries = () => {
        const newEntries = entries.filter(entry => !entry.isKilled);
        onUpdate(newEntries);
    };


    const adjustHP = (id: string, adjustment: string) => {
        const entry = entries.find(e => e.id === id);
        if (!entry || entry.hp === undefined) return;

        const currentHP = entry.hp;
        const adjustmentValue = parseInt(adjustment);
        if (isNaN(adjustmentValue)) return;

        const newHP = currentHP + adjustmentValue;
        const finalHP = newHP <= 0 ? newHP : Math.max(0, newHP);

        // Update HP first
        const newEntries = entries.map(entry =>
            entry.id === id ? { ...entry, hp: finalHP } : entry
        );

        // Then kill if needed
        if (newHP <= 0) {
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

                    onUpdate(finalEntries);
                    return;
                }
            }

            // If not current turn, just mark as killed
            const killedEntries = newEntries.map(entry =>
                entry.id === id ? { ...entry, isKilled: true, isCurrentTurn: false } : entry
            );
            onUpdate(killedEntries);
            return;
        }

        onUpdate(newEntries);
    };

    const moveToNextTurn = () => {
        if (entries.length === 0) return;

        const aliveEntries = entries.filter(entry => !entry.isKilled);
        if (aliveEntries.length === 0) return;

        const currentIndex = aliveEntries.findIndex(entry => entry.isCurrentTurn);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % aliveEntries.length;

        const newEntries = entries.map((entry) => ({
            ...entry,
            isCurrentTurn: !entry.isKilled && entry.id === aliveEntries[nextIndex].id
        }));

        onUpdate(newEntries);
    };

    const moveToPreviousTurn = () => {
        if (entries.length === 0) return;

        const aliveEntries = entries.filter(entry => !entry.isKilled);
        if (aliveEntries.length === 0) return;

        const currentIndex = aliveEntries.findIndex(entry => entry.isCurrentTurn);
        const prevIndex = currentIndex === -1 ? aliveEntries.length - 1 : (currentIndex - 1 + aliveEntries.length) % aliveEntries.length;

        const newEntries = entries.map((entry) => ({
            ...entry,
            isCurrentTurn: !entry.isKilled && entry.id === aliveEntries[prevIndex].id
        }));

        onUpdate(newEntries);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = entries.findIndex((entry) => entry.id === active.id);
            const newIndex = entries.findIndex((entry) => entry.id === over.id);

            const newEntries = arrayMove(entries, oldIndex, newIndex);
            onUpdate(newEntries);
        }
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
        addEntry(playerName, parseInt(playerInitiative), true);
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
        addEntry(enemyName, parseInt(enemyInitiative), false, enemyHP ? parseInt(enemyHP) : undefined);
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

        onUpdate([...entries, ...newEntries].sort((a, b) => b.initiative - a.initiative));

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
        </>
    );
}; 