import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface InitiativeEntry {
    id: string;
    name: string;
    initiative: number;
    isPlayer: boolean;
    isCurrentTurn: boolean;
}

interface InitiativeFormProps {
    isAdmin: boolean;
    onAddEntry: (entry: InitiativeEntry) => void;
    onRemoveEntry: (id: string) => void;
}

const InitiativeForm: React.FC<InitiativeFormProps> = ({ isAdmin, onAddEntry }) => {
    const { toast } = useToast();
    const [playerName, setPlayerName] = useState('');
    const [initiative, setInitiative] = useState('');
    const [playerNames, setPlayerNames] = useState<string[]>([]);

    const addEntry = (name: string, initiative: number, isPlayer: boolean) => {
        const newEntry: InitiativeEntry = {
            id: Date.now().toString(),
            name,
            initiative,
            isPlayer,
            isCurrentTurn: false
        };

        onAddEntry(newEntry);

        if (isPlayer && !playerNames.includes(name)) {
            setPlayerNames(prev => [...prev, name]);
        }

        setPlayerName('');
        setInitiative('');
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="flex-1 min-w-[200px]">
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
                <div className="w-24">
                    <Input
                        type="number"
                        placeholder="Initiative"
                        value={initiative}
                        onChange={(e) => setInitiative(e.target.value)}
                    />
                </div>
                <Button
                    onClick={() => {
                        if (!playerName || !initiative) {
                            toast({
                                title: "Error",
                                description: "Please enter both name and initiative",
                                variant: "destructive",
                            });
                            return;
                        }
                        addEntry(playerName, parseInt(initiative), true);
                    }}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {isAdmin && (
                <div className="flex gap-2">
                    <div className="flex-1 min-w-[200px]">
                        <Input
                            type="text"
                            placeholder="Enemy name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                        />
                    </div>
                    <div className="w-24">
                        <Input
                            type="number"
                            placeholder="Initiative"
                            value={initiative}
                            onChange={(e) => setInitiative(e.target.value)}
                        />
                    </div>
                    <Button
                        onClick={() => {
                            if (!playerName || !initiative) {
                                toast({
                                    title: "Error",
                                    description: "Please enter both name and initiative",
                                    variant: "destructive",
                                });
                                return;
                            }
                            addEntry(playerName, parseInt(initiative), false);
                        }}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
};

interface InitiativeDisplayProps {
    entries: InitiativeEntry[];
    isAdmin: boolean;
    onRemoveEntry: (id: string) => void;
    onNextTurn: () => void;
    onPreviousTurn: () => void;
}

const InitiativeDisplay: React.FC<InitiativeDisplayProps> = ({
    entries,
    isAdmin,
    onRemoveEntry,
    onNextTurn,
    onPreviousTurn
}) => {
    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPreviousTurn}>
                <ChevronUp className="h-4 w-4" />
            </Button>
            <div className="flex gap-2">
                {entries.map((entry) => (
                    <div
                        key={entry.id}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md",
                            entry.isCurrentTurn ? "bg-zinc-800" : "bg-zinc-900/50",
                            entry.isPlayer ? "text-zinc-300" : "text-zinc-400"
                        )}
                    >
                        <span className="font-medium">
                            {entry.isPlayer || isAdmin ? entry.name : "DM"}
                        </span>
                        <span className="text-sm">{entry.initiative}</span>
                        {isAdmin && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemoveEntry(entry.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ))}
            </div>
            <Button variant="outline" size="sm" onClick={onNextTurn}>
                <ChevronDown className="h-4 w-4" />
            </Button>
        </div>
    );
};

interface InitiativeTrackerProps {
    isAdmin: boolean;
    onAddEntry: (entry: InitiativeEntry) => void;
    onRemoveEntry: (id: string) => void;
}

export const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
    isAdmin,
    onAddEntry,
    onRemoveEntry
}) => {
    return (
        <div className="w-full max-w-md mx-auto p-4 bg-zinc-900/50 rounded-lg">
            <InitiativeForm
                isAdmin={isAdmin}
                onAddEntry={onAddEntry}
                onRemoveEntry={onRemoveEntry}
            />
        </div>
    );
};

export const InitiativeOrder: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
    const [entries, setEntries] = useState<InitiativeEntry[]>([]);

    const removeEntry = (id: string) => {
        setEntries(prev => prev.filter(entry => entry.id !== id));
    };

    const moveToNextTurn = () => {
        if (entries.length === 0) return;

        setEntries(prev => {
            const currentIndex = prev.findIndex(entry => entry.isCurrentTurn);
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % prev.length;

            return prev.map((entry, index) => ({
                ...entry,
                isCurrentTurn: index === nextIndex
            }));
        });
    };

    const moveToPreviousTurn = () => {
        if (entries.length === 0) return;

        setEntries(prev => {
            const currentIndex = prev.findIndex(entry => entry.isCurrentTurn);
            const prevIndex = currentIndex === -1 ? prev.length - 1 : (currentIndex - 1 + prev.length) % prev.length;

            return prev.map((entry, index) => ({
                ...entry,
                isCurrentTurn: index === prevIndex
            }));
        });
    };

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
            <InitiativeDisplay
                entries={entries}
                isAdmin={isAdmin}
                onRemoveEntry={removeEntry}
                onNextTurn={moveToNextTurn}
                onPreviousTurn={moveToPreviousTurn}
            />
        </div>
    );
}; 