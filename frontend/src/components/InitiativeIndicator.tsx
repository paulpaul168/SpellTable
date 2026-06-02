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
        <div className="pointer-events-none absolute left-1/2 top-6 z-[1000] -translate-x-1/2">
            <div className="glass-panel rounded-lg px-6 py-3 shadow-xl">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-muted-foreground">Current</span>
                            <span className="text-base font-bold text-foreground">
                                {currentPlayer.isPlayer ? currentPlayer.name : 'DM'}
                            </span>
                        </div>
                    </div>
                    {nextPlayer && nextPlayer.id !== currentPlayer.id && (
                        <>
                            <div className="h-8 w-px bg-border" />
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-muted-foreground">Next</span>
                                    <span className="text-base font-medium text-foreground">
                                        {nextPlayer.isPlayer ? nextPlayer.name : 'DM'}
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