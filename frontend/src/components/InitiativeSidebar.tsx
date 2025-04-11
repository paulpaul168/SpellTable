import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';
import { Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Skull, X } from 'lucide-react';
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
}

export const InitiativeSidebar: React.FC<InitiativeSidebarProps> = ({
    isAdmin,
    entries = [],
    onUpdate,
    showCurrentPlayer,
    onToggleCurrentPlayer
}) => {
    const { toast } = useToast();
    const [playerName, setPlayerName] = useState('');
    const [playerInitiative, setPlayerInitiative] = useState('');
    const [enemyName, setEnemyName] = useState('');
    const [enemyInitiative, setEnemyInitiative] = useState('');
    const [enemyHP, setEnemyHP] = useState('');
    const [playerNames, setPlayerNames] = useState<string[]>([]);

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
        const newEntries = entries.map(entry =>
            entry.id === id ? { ...entry, isKilled: true } : entry
        );
        onUpdate(newEntries);
    };

    const clearKilledEntries = () => {
        const newEntries = entries.filter(entry => !entry.isKilled);
        onUpdate(newEntries);
    };

    const updateHP = (id: string, hp: number) => {
        const newEntries = entries.map(entry =>
            entry.id === id ? { ...entry, hp } : entry
        );
        onUpdate(newEntries);
    };

    const moveToNextTurn = () => {
        if (entries.length === 0) return;

        const currentIndex = entries.findIndex(entry => entry.isCurrentTurn);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % entries.length;

        const newEntries = entries.map((entry, index) => ({
            ...entry,
            isCurrentTurn: index === nextIndex
        }));

        onUpdate(newEntries);
    };

    const moveToPreviousTurn = () => {
        if (entries.length === 0) return;

        const currentIndex = entries.findIndex(entry => entry.isCurrentTurn);
        const prevIndex = currentIndex === -1 ? entries.length - 1 : (currentIndex - 1 + entries.length) % entries.length;

        const newEntries = entries.map((entry, index) => ({
            ...entry,
            isCurrentTurn: index === prevIndex
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

    return (
        <div className="fixed bottom-0 left-0 w-[320px] h-[80%] bg-zinc-900/50 backdrop-blur-sm border-t border-zinc-800/50 flex flex-col">
            <div className="p-4 border-b border-zinc-800/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-300">Initiative</h3>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={moveToPreviousTurn}>
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={moveToNextTurn}>
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onToggleCurrentPlayer}
                            title={showCurrentPlayer ? "Hide current player indicator" : "Show current player indicator"}
                        >
                            {showCurrentPlayer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {isAdmin && (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Input
                                        type="text"
                                        placeholder="Player name"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        list="playerNames"
                                    />
                                    <datalist id="playerNames">
                                        {playerNames.map(name => (
                                            <option key={name} value={name} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="w-20">
                                    <Input
                                        type="number"
                                        placeholder="Init"
                                        value={playerInitiative}
                                        onChange={(e) => setPlayerInitiative(e.target.value)}
                                    />
                                </div>
                                <Button
                                    onClick={() => {
                                        if (!playerName || !playerInitiative) {
                                            toast({
                                                title: "Error",
                                                description: "Please enter both name and initiative",
                                                variant: "destructive",
                                            });
                                            return;
                                        }
                                        addEntry(playerName, parseInt(playerInitiative), true);
                                    }}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Input
                                        type="text"
                                        placeholder="Enemy name"
                                        value={enemyName}
                                        onChange={(e) => setEnemyName(e.target.value)}
                                    />
                                </div>
                                <div className="w-20">
                                    <Input
                                        type="number"
                                        placeholder="Init"
                                        value={enemyInitiative}
                                        onChange={(e) => setEnemyInitiative(e.target.value)}
                                    />
                                </div>
                                <div className="w-20">
                                    <Input
                                        type="number"
                                        placeholder="HP"
                                        value={enemyHP}
                                        onChange={(e) => setEnemyHP(e.target.value)}
                                    />
                                </div>
                                <Button
                                    onClick={() => {
                                        if (!enemyName || !enemyInitiative) {
                                            toast({
                                                title: "Error",
                                                description: "Please enter both name and initiative",
                                                variant: "destructive",
                                            });
                                            return;
                                        }
                                        addEntry(enemyName, parseInt(enemyInitiative), false, enemyHP ? parseInt(enemyHP) : undefined);
                                    }}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
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
                                    entry.isPlayer ? "text-zinc-300" : "text-zinc-400",
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
                                        <Input
                                            type="number"
                                            value={entry.hp}
                                            onChange={(e) => updateHP(entry.id, parseInt(e.target.value))}
                                            className="w-16 h-6 text-sm"
                                        />
                                    )}
                                    <span className="text-sm font-mono">{entry.initiative}</span>
                                    {isAdmin && (
                                        <div className="flex gap-1">
                                            {!entry.isKilled && (
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
    );
}; 