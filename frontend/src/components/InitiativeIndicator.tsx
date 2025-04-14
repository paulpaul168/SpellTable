import React from 'react';
import { InitiativeEntry } from '../types/map';

interface InitiativeIndicatorProps {
    initiativeOrder: InitiativeEntry[];
    showCurrentPlayer: boolean;
}

export const InitiativeIndicator: React.FC<InitiativeIndicatorProps> = ({
    initiativeOrder,
    showCurrentPlayer
}) => {
    if (!showCurrentPlayer || initiativeOrder.length === 0) {
        return null;
    }

    const currentPlayer = initiativeOrder.find(entry => entry.isCurrentTurn) || initiativeOrder[0];
    const currentIndex = initiativeOrder.findIndex(entry => entry.id === currentPlayer.id);
    const nextPlayer = initiativeOrder[(currentIndex + 1) % initiativeOrder.length];

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
            <div className="px-4 py-2 rounded-md bg-zinc-900/80 backdrop-blur-sm border border-zinc-800">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-xs text-zinc-400">Current</span>
                            <span className="text-sm font-medium text-zinc-300">
                                {currentPlayer.isPlayer ? currentPlayer.name : "DM"}
                            </span>
                        </div>
                    </div>
                    {nextPlayer && nextPlayer.id !== currentPlayer.id && (
                        <>
                            <div className="h-4 w-px bg-zinc-700" />
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-zinc-500" />
                                <div className="flex flex-col">
                                    <span className="text-xs text-zinc-400">Next</span>
                                    <span className="text-sm font-medium text-zinc-400">
                                        {nextPlayer.isPlayer ? nextPlayer.name : "DM"}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}; 