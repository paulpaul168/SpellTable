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
    const [playerName, setPlayerName] = useState('');
    const [playerInitiative, setPlayerInitiative] = useState('');
    const [enemyName, setEnemyName] = useState('');
    const [enemyInitiative, setEnemyInitiative] = useState('');
    const [enemyHP, setEnemyHP] = useState('');
    const [playerNames, setPlayerNames] = useState<string[]>([]);
    const playerNameRef = useRef<HTMLInputElement>(null);
    const enemyNameRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const addEntry = (name: string, initiative: number, isPlayer: boolean, hp?: number) => {
        const newEntry: InitiativeEntry = {
            id: Date.now().toString(),
            name,
            initiative,
            isPlayer,
            isCurrentTurn: false,
            hp: hp,
            initialHP: hp,
            isKilled: false
        };

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
                <div className="fixed bottom-0 left-0 w-[320px] min-h-[200px] max-h-[80%] bg-zinc-900/50 backdrop-blur-sm border-t border-zinc-800/50 flex flex-col rounded-tr-lg">
                    <div className="p-4 border-b border-zinc-800/50">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-zinc-300">Initiative</h3>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={moveToPreviousTurn}>
                                    <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={moveToNextTurn}>
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={onToggleCurrentPlayer}
                                    title={showCurrentPlayer ? "Hide current player indicator" : "Show current player indicator"}
                                >
                                    {showCurrentPlayer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={onClose}
                                    title="Close sidebar"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {isAdmin && (
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <div className="flex gap-1">
                                                <Input
                                                    ref={playerNameRef}
                                                    type="text"
                                                    placeholder="Player name"
                                                    value={playerName}
                                                    onChange={(e) => setPlayerName(e.target.value)}
                                                    list="playerNames"
                                                    className="h-8 text-xs"
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
                                                    className="w-16 h-8 text-xs"
                                                />
                                                <Button
                                                    onClick={addPlayerEntry}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <datalist id="playerNames">
                                                {playerNames.map(name => (
                                                    <option key={name} value={name} />
                                                ))}
                                            </datalist>
                                        </div>
                                    </div>

                                    <div className="h-px bg-zinc-800/50 my-2" />

                                    <div className="flex gap-2">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <div className="flex gap-1">
                                                <Input
                                                    ref={enemyNameRef}
                                                    type="text"
                                                    placeholder="Enemy name"
                                                    value={enemyName}
                                                    onChange={(e) => setEnemyName(e.target.value)}
                                                    className="h-8 text-xs"
                                                />
                                                <Input
                                                    type="number"
                                                    placeholder="HP"
                                                    value={enemyHP}
                                                    onChange={(e) => setEnemyHP(e.target.value)}
                                                    className="w-16 h-8 text-xs"
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
                                                    className="w-16 h-8 text-xs"
                                                />
                                                <Button
                                                    onClick={addEnemyEntry}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
                                            "flex items-center justify-between p-2 rounded-md",
                                            entry.isCurrentTurn ? "bg-emerald-500/20" : "hover:bg-zinc-800/50",
                                            entry.isPlayer ? "text-zinc-300" : "text-red-400",
                                            entry.isKilled ? "opacity-50" : ""
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
                                            <span className="text-xs font-mono text-zinc-500">{entry.initiative}</span>
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
                    </div>

                    {isAdmin && entries.some(entry => entry.isKilled) && (
                        <div className="p-2 border-t border-zinc-800/50">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={clearKilledEntries}
                            >
                                <X className="h-4 w-4 mr-2" />
                                Clear Killed Entries
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}; 