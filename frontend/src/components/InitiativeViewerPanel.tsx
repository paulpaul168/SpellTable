'use client';

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { Skull } from 'lucide-react';
import { InitiativeEntry } from '../types/map';
import { cn } from '@/lib/utils';

interface InitiativeViewerPanelProps {
    entries: InitiativeEntry[];
}

function scrollRowIntoListCenter(
    container: HTMLDivElement,
    row: HTMLDivElement
) {
    const rowTop = row.offsetTop;
    const rowHeight = row.offsetHeight;
    const containerHeight = container.clientHeight;
    const targetScroll =
        rowTop - containerHeight / 2 + rowHeight / 2;
    container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
    });
}

function sortByInitiative(entries: InitiativeEntry[]): InitiativeEntry[] {
    return [...entries].sort((a, b) => b.initiative - a.initiative);
}

function getNextEntry(
    sorted: InitiativeEntry[],
    current: InitiativeEntry
): InitiativeEntry | null {
    const index = sorted.findIndex((e) => e.id === current.id);
    if (index === -1 || sorted.length < 2) return null;
    const next = sorted[(index + 1) % sorted.length];
    return next.id === current.id ? null : next;
}

/** Coarse 0–4 health pips from current vs max HP (no numeric display). */
function enemyHealthPips(entry: InitiativeEntry): number {
    if (entry.isKilled) return 0;
    if (entry.hp === undefined) return 0;
    const max = entry.initialHP ?? entry.hp;
    if (max <= 0) return 0;
    const ratio = Math.max(0, entry.hp) / max;
    if (ratio <= 0) return 0;
    return Math.min(4, Math.ceil(ratio * 4));
}

function EnemyHealthDots({ entry }: { entry: InitiativeEntry }) {
    if (entry.isPlayer || entry.hp === undefined) return null;

    const filled = enemyHealthPips(entry);

    return (
        <div
            className="flex shrink-0 items-center gap-1"
            role="img"
            aria-label={
                entry.isKilled
                    ? 'Defeated'
                    : `Health ${filled} of 4`
            }
        >
            {Array.from({ length: 4 }, (_, i) => (
                <span
                    key={i}
                    className={cn(
                        'h-2.5 w-2.5 rounded-full border',
                        i < filled
                            ? 'border-red-400 bg-red-500'
                            : 'border-red-900/60 bg-red-950/40'
                    )}
                />
            ))}
        </div>
    );
}

export const InitiativeViewerPanel: React.FC<InitiativeViewerPanelProps> = ({
    entries,
}) => {
    const sorted = useMemo(() => sortByInitiative(entries), [entries]);
    const currentEntry = sorted.find((e) => e.isCurrentTurn);
    const nextEntry = currentEntry ? getNextEntry(sorted, currentEntry) : null;
    const listRef = useRef<HTMLDivElement>(null);
    const currentRowRef = useRef<HTMLDivElement | null>(null);
    const prevCurrentIdRef = useRef<string | null>(null);

    const scrollToCurrentTurn = useCallback(() => {
        const container = listRef.current;
        const row = currentRowRef.current;
        if (container && row) {
            scrollRowIntoListCenter(container, row);
        }
    }, []);

    useEffect(() => {
        const currentId = currentEntry?.id ?? null;
        if (!currentId) {
            prevCurrentIdRef.current = null;
            return;
        }

        const turnChanged = currentId !== prevCurrentIdRef.current;
        prevCurrentIdRef.current = currentId;

        if (!turnChanged) return;

        const id = requestAnimationFrame(() => {
            scrollToCurrentTurn();
            // Retry after layout when hero/list height settles
            window.setTimeout(scrollToCurrentTurn, 100);
        });

        return () => cancelAnimationFrame(id);
    }, [currentEntry?.id, scrollToCurrentTurn]);

    const assignCurrentRowRef = useCallback(
        (el: HTMLDivElement | null, isCurrentTurn: boolean) => {
            if (isCurrentTurn) {
                currentRowRef.current = el;
            } else if (currentRowRef.current === el) {
                currentRowRef.current = null;
            }
        },
        []
    );

    if (sorted.length === 0) {
        return (
            <div className="glass-panel rounded-xl px-8 py-12 text-center">
                <p className="text-muted-foreground">
                    No initiative order has been set
                </p>
                <p className="mt-2 text-sm text-muted-foreground/70">
                    Waiting for the DM to start combat
                </p>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-4">
            {currentEntry && (
                <div className="glass-panel rounded-xl px-6 py-5 lg:px-8 lg:py-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-primary" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Active turn · Initiative {currentEntry.initiative}
                                </p>
                                <p
                                    className={cn(
                                        'truncate text-3xl font-bold tracking-tight lg:text-4xl',
                                        currentEntry.isPlayer
                                            ? 'text-foreground'
                                            : 'text-red-200'
                                    )}
                                >
                                    {currentEntry.name}
                                </p>
                            </div>
                        </div>
                        {nextEntry && (
                            <div className="text-right">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Next
                                </p>
                                <p
                                    className={cn(
                                        'text-lg font-medium',
                                        nextEntry.isPlayer
                                            ? 'text-foreground'
                                            : 'text-red-200'
                                    )}
                                >
                                    {nextEntry.name}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div
                ref={listRef}
                className="glass-panel glass-panel-scroll max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl"
                role="list"
                aria-label="Initiative order"
            >
                <div className="divide-y divide-border/50">
                    {sorted.map((entry, index) => (
                        <div
                            key={entry.id}
                            ref={(el) =>
                                assignCurrentRowRef(el, entry.isCurrentTurn)
                            }
                            role="listitem"
                            className={cn(
                                'flex items-center gap-3 border-l-2 px-4 py-3 transition-colors lg:gap-4 lg:px-5 lg:py-3.5',
                                entry.isCurrentTurn
                                    ? 'border-primary bg-accent/20'
                                    : 'border-transparent',
                                entry.isKilled && 'opacity-50'
                            )}
                        >
                            <span className="w-8 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                                #{index + 1}
                            </span>
                            <span className="w-10 shrink-0 font-mono text-sm tabular-nums text-muted-foreground lg:w-12 lg:text-base">
                                {entry.initiative}
                            </span>
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                {entry.isCurrentTurn && (
                                    <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
                                )}
                                {entry.isKilled && (
                                    <Skull
                                        className="h-4 w-4 shrink-0 text-muted-foreground"
                                        aria-hidden
                                    />
                                )}
                                <span
                                    className={cn(
                                        'truncate text-base font-medium lg:text-lg',
                                        entry.isKilled && 'line-through',
                                        entry.isPlayer
                                            ? 'text-foreground'
                                            : 'text-red-200'
                                    )}
                                >
                                    {entry.name}
                                </span>
                            </div>
                            <EnemyHealthDots entry={entry} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
