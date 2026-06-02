import React, { useState, useRef, useEffect, useCallback, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { InitiativeEntry, MapPosition } from '../types/map';
import {
    getPlayAreaRect,
    pointerToAoEPosition,
    toDisplayPixels,
    type AoEGridSettings,
} from '@/utils/aoeCoordinates';
import {
    DEFAULT_TOKEN_FOOTPRINT,
    getTokenDiameterPixels,
    normalizeTokenFootprint,
    TOKEN_FOOTPRINT_DND,
    TOKEN_FOOTPRINT_FEET,
    TOKEN_FOOTPRINTS,
    type TokenFootprint,
} from '@/utils/tokenFootprint';
import { cn } from '../lib/utils';

/** Closes any other token's open context menu before opening a new one. */
let closeOtherTokenMenus: (() => void) | null = null;

interface CombatantTokenProps {
    entry: InitiativeEntry;
    isAdmin: boolean;
    onUpdate: (updatedEntry: InitiativeEntry) => void;
    containerRef?: RefObject<HTMLElement | null>;
    gridSettings?: AoEGridSettings & {
        defaultTokenFootprint?: TokenFootprint;
        defaultTokenSize?: number;
    };
    defaultTokenFootprint?: TokenFootprint;
}

function positionedEntry(entry: InitiativeEntry): {
    position: { x: number; y: number };
    useGridCoordinates?: boolean;
} {
    const pos = entry.mapPosition!;
    return {
        position: { x: pos.x, y: pos.y },
        useGridCoordinates: pos.useGridCoordinates,
    };
}

export const CombatantToken: React.FC<CombatantTokenProps> = ({
    entry,
    isAdmin,
    onUpdate,
    containerRef,
    gridSettings,
    defaultTokenFootprint = DEFAULT_TOKEN_FOOTPRINT,
}) => {
    const mapPosition = entry.mapPosition;
    if (!mapPosition) return null;

    const [isDragging, setIsDragging] = useState(false);
    const [tokenDiameter, setTokenDiameter] = useState(48);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<InitiativeEntry | null>(null);
    const mouseDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const tokenRef = useRef<HTMLDivElement>(null);

    const gridCellsX = gridSettings?.gridCellsX ?? 25;
    const gridCellsY = gridSettings?.gridCellsY ?? 13;
    const aoeSnapToGrid = gridSettings?.aoeSnapToGrid !== false;
    const sceneDefaultFootprint =
        gridSettings?.defaultTokenFootprint ??
        (gridSettings?.defaultTokenSize !== undefined &&
        (gridSettings.defaultTokenSize === 1 ||
            gridSettings.defaultTokenSize === 2 ||
            gridSettings.defaultTokenSize === 3)
            ? (gridSettings.defaultTokenSize as TokenFootprint)
            : undefined) ??
        defaultTokenFootprint;
    const footprint = normalizeTokenFootprint(entry, sceneDefaultFootprint);

    const getContainerRect = useCallback(() => {
        return getPlayAreaRect(containerRef?.current ?? null);
    }, [containerRef]);

    const updateDiameter = useCallback(() => {
        const containerRect = getContainerRect();
        setTokenDiameter(
            getTokenDiameterPixels(footprint, containerRect, gridCellsX, gridCellsY)
        );
    }, [footprint, getContainerRect, gridCellsX, gridCellsY]);

    const calculatePosition = useCallback(() => {
        const containerRect = getContainerRect();
        return toDisplayPixels(
            positionedEntry(entry),
            gridSettings,
            containerRect,
            gridCellsX,
            gridCellsY
        );
    }, [entry, gridSettings, getContainerRect, gridCellsX, gridCellsY]);

    const [currentPos, setCurrentPos] = useState(calculatePosition);

    useEffect(() => {
        updateDiameter();
        window.addEventListener('resize', updateDiameter);
        return () => window.removeEventListener('resize', updateDiameter);
    }, [updateDiameter]);

    useEffect(() => {
        if (isDraggingRef.current) return;
        const updatePosition = () => setCurrentPos(calculatePosition());
        updatePosition();
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);
    }, [mapPosition, calculatePosition]);

    const throttledUpdate = useCallback(
        (updatedEntry: InitiativeEntry) => {
            const now = performance.now();
            if (now - lastUpdateRef.current >= 32) {
                onUpdate(updatedEntry);
                lastUpdateRef.current = now;
                pendingUpdateRef.current = null;
            } else {
                pendingUpdateRef.current = updatedEntry;
                requestAnimationFrame(() => {
                    const pending = pendingUpdateRef.current;
                    if (pending) {
                        onUpdate(pending);
                        pendingUpdateRef.current = null;
                    }
                    lastUpdateRef.current = performance.now();
                });
            }
        },
        [onUpdate]
    );

    const applyDragAtClient = useCallback(
        (clientX: number, clientY: number, ctrlKey: boolean) => {
            const containerRect = getContainerRect();
            const containerRelativeX =
                clientX - containerRect.left - mouseDragOffsetRef.current.x;
            const containerRelativeY =
                clientY - containerRect.top - mouseDragOffsetRef.current.y;

            const snapDisplay = aoeSnapToGrid || ctrlKey;
            const { position, useGridCoordinates, displayPixels } = pointerToAoEPosition(
                containerRelativeX,
                containerRelativeY,
                snapDisplay,
                aoeSnapToGrid,
                containerRect,
                gridCellsX,
                gridCellsY
            );

            const newMapPosition: MapPosition = { ...position, useGridCoordinates };
            setCurrentPos(displayPixels);
            throttledUpdate({ ...entry, mapPosition: newMapPosition });
        },
        [entry, getContainerRect, gridCellsX, gridCellsY, throttledUpdate, aoeSnapToGrid]
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            applyDragAtClient(e.clientX, e.clientY, e.ctrlKey);
        },
        [applyDragAtClient]
    );

    const handleMouseUp = useCallback(
        (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            e.preventDefault();
            applyDragAtClient(e.clientX, e.clientY, e.ctrlKey);
            pendingUpdateRef.current = null;
            lastUpdateRef.current = performance.now();
            setIsDragging(false);
            isDraggingRef.current = false;
            document.body.classList.remove('dragging-token');
        },
        [applyDragAtClient]
    );

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove, { capture: true });
        window.addEventListener('mouseup', handleMouseUp, { capture: true });
        return () => {
            window.removeEventListener('mousemove', handleMouseMove, { capture: true });
            window.removeEventListener('mouseup', handleMouseUp, { capture: true });
            document.body.classList.remove('dragging-token');
        };
    }, [handleMouseMove, handleMouseUp]);

    const closeThisMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    useEffect(() => {
        return () => {
            if (closeOtherTokenMenus === closeThisMenu) {
                closeOtherTokenMenus = null;
            }
        };
    }, [closeThisMenu]);

    useEffect(() => {
        if (!contextMenu) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (e.button === 2) return;
            const target = e.target as Node;
            if (tokenRef.current?.contains(target)) return;
            if (
                target instanceof Element &&
                target.closest('[data-token-context-menu]')
            ) {
                return;
            }
            setContextMenu(null);
        };

        const handleScroll = () => setContextMenu(null);
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null);
        };

        // Defer so the opening right-click does not immediately dismiss the menu
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
    }, [contextMenu]);

    const setFootprint = (newFootprint: TokenFootprint) => {
        onUpdate({
            ...entry,
            tokenFootprint: newFootprint,
            tokenSize: undefined,
        });
        setContextMenu(null);
        if (closeOtherTokenMenus === closeThisMenu) {
            closeOtherTokenMenus = null;
        }
    };

    const openContextMenu = (clientX: number, clientY: number) => {
        closeOtherTokenMenus?.();
        closeOtherTokenMenus = closeThisMenu;
        setContextMenu({ x: clientX, y: clientY });
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!isAdmin) return;
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e.clientX, e.clientY);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isAdmin) return;
        if (e.button === 2) {
            e.stopPropagation();
            return;
        }
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();

        const containerRect = getContainerRect();
        const display = calculatePosition();
        mouseDragOffsetRef.current = {
            x: e.clientX - containerRect.left - display.x,
            y: e.clientY - containerRect.top - display.y,
        };
        setIsDragging(true);
        isDraggingRef.current = true;
        document.body.classList.add('dragging-token');
    };

    const showEnemyRipple =
        entry.isCurrentTurn && !entry.isPlayer && !entry.isKilled;
    const showPlayerTurnGlow = entry.isCurrentTurn && entry.isPlayer;

    const half = tokenDiameter / 2;

    return (
        <div
            ref={tokenRef}
            className={cn(
                'absolute select-none',
                isAdmin && 'cursor-grab active:cursor-grabbing',
                isDragging && 'z-[950]'
            )}
            style={{
                left: currentPos.x - half,
                top: currentPos.y - half,
                width: tokenDiameter,
                height: tokenDiameter,
                zIndex: isDragging ? 950 : 905,
            }}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
            onClick={(e) => e.stopPropagation()}
            title={isAdmin ? 'Right-click to change size' : undefined}
        >
            {showEnemyRipple && (
                <div className="absolute inset-0 pointer-events-none">
                    <div
                        className="absolute inset-0 rounded-full border-2 border-destructive animate-ripple-1"
                        style={{ margin: -4 }}
                    />
                    <div
                        className="absolute inset-0 rounded-full border-2 border-destructive animate-ripple-2"
                        style={{ margin: -4 }}
                    />
                    <div
                        className="absolute inset-0 rounded-full border-2 border-destructive animate-ripple-3"
                        style={{ margin: -4 }}
                    />
                </div>
            )}

            <div
                className={cn(
                    'relative flex h-full w-full flex-col items-center justify-center rounded-full border-2 bg-background/80 shadow-md backdrop-blur-sm',
                    entry.isPlayer
                        ? 'border-primary text-primary'
                        : 'border-destructive text-destructive',
                    showPlayerTurnGlow && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    isDragging && 'opacity-90'
                )}
                onContextMenu={handleContextMenu}
            >
                <span
                    className="max-w-[90%] truncate px-1 text-center font-semibold leading-tight"
                    style={{ fontSize: Math.max(9, Math.min(12, tokenDiameter / 5)) }}
                    title={entry.name}
                >
                    {entry.name}
                </span>
            </div>

            {contextMenu &&
                isAdmin &&
                createPortal(
                    <div
                        data-token-context-menu
                        role="menu"
                        className="fixed z-[10002] min-w-[11rem] overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Token size
                        </p>
                        {TOKEN_FOOTPRINTS.map((fp) => (
                            <button
                                key={fp}
                                type="button"
                                className={cn(
                                    'flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-sm hover:bg-accent',
                                    footprint === fp && 'bg-accent/60 font-medium'
                                )}
                                onClick={() => setFootprint(fp)}
                            >
                                <span>{TOKEN_FOOTPRINT_DND[fp]}</span>
                                <span className="text-xs text-muted-foreground">
                                    {TOKEN_FOOTPRINT_FEET[fp]}ft ({fp}×{fp})
                                </span>
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    );
};
