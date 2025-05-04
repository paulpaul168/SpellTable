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
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="px-6 py-3 rounded-lg bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 shadow-xl">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-sm text-zinc-400 font-medium">Current</span>
                            <span className="text-base font-bold text-zinc-200">
                                {currentPlayer.isPlayer ? currentPlayer.name : "DM"}
                            </span>
                        </div>
                    </div>
                    {nextPlayer && nextPlayer.id !== currentPlayer.id && (
                        <>
                            <div className="h-8 w-px bg-zinc-700" />
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-zinc-500" />
                                <div className="flex flex-col">
                                    <span className="text-sm text-zinc-400 font-medium">Next</span>
                                    <span className="text-base font-medium text-zinc-300">
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