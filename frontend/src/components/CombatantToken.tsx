import React, { useState, useRef, useEffect, useCallback, memo, RefObject, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { InitiativeEntry, MapPosition } from '../types/map';
import { getPlayAreaRect, type AoEGridSettings } from '@/utils/aoeCoordinates';
import {
    DEFAULT_TOKEN_FOOTPRINT,
    displayPixelsToMeasurePoint,
    getTokenDiameterPixels,
    normalizeTokenFootprint,
    pointerToTokenPosition,
    TOKEN_FOOTPRINT_DND,
    TOKEN_FOOTPRINT_FEET,
    TOKEN_FOOTPRINTS,
    tokenMapPositionToDisplayPixels,
    type TokenFootprint,
} from '@/utils/tokenFootprint';
import { cn } from '../lib/utils';
import { createThrottledLiveSync, type LiveSyncOptions } from '@/utils/liveSync';
import { COMBATANT_TOKEN_Z_INDEX } from '@/utils/playAreaLayers';
import type { MeasurePoint } from '@/utils/measureDistance';

/** Closes any other token's open context menu before opening a new one. */
let closeOtherTokenMenus: (() => void) | null = null;

interface CombatantTokenProps {
    entry: InitiativeEntry;
    isAdmin: boolean;
    onUpdate: (updatedEntry: InitiativeEntry, options?: LiveSyncOptions) => void;
    containerRef?: RefObject<HTMLElement | null>;
    gridSettings?: AoEGridSettings & {
        defaultTokenFootprint?: TokenFootprint;
        defaultTokenSize?: number;
        tokenSnapToGrid?: boolean;
    };
    defaultTokenFootprint?: TokenFootprint;
    movementPath?: MapPosition[];
    onMovementStop?: (position: MapPosition) => void;
    onResetMovement?: () => void;
    onMovementPreviewChange?: (point: MeasurePoint | null) => void;
}

export const CombatantToken = memo(function CombatantToken({
    entry,
    isAdmin,
    onUpdate,
    containerRef,
    gridSettings,
    defaultTokenFootprint = DEFAULT_TOKEN_FOOTPRINT,
    movementPath,
    onMovementStop,
    onResetMovement,
    onMovementPreviewChange,
}: CombatantTokenProps) {
    const mapPosition = entry.mapPosition;
    if (!mapPosition) return null;

    const [isDragging, setIsDragging] = useState(false);
    const [tokenDiameter, setTokenDiameter] = useState(48);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const pendingUpdateRef = useRef<InitiativeEntry | null>(null);
    const mouseDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const tokenRef = useRef<HTMLDivElement>(null);

    const gridCellsX = gridSettings?.gridCellsX ?? 25;
    const gridCellsY = gridSettings?.gridCellsY ?? 13;
    const tokenSnapToGrid = gridSettings?.tokenSnapToGrid !== false;
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

    const liveSync = useMemo(() => createThrottledLiveSync(onUpdate), [onUpdate]);

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
        return tokenMapPositionToDisplayPixels(
            mapPosition,
            containerRect,
            gridCellsX,
            gridCellsY
        );
    }, [mapPosition, getContainerRect, gridCellsX, gridCellsY]);

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

    const applyDragAtClient = useCallback(
        (clientX: number, clientY: number) => {
            const containerRect = getContainerRect();
            const containerRelativeX =
                clientX - containerRect.left - mouseDragOffsetRef.current.x;
            const containerRelativeY =
                clientY - containerRect.top - mouseDragOffsetRef.current.y;

            const { mapPosition: newMapPosition, displayPixels } = pointerToTokenPosition(
                containerRelativeX,
                containerRelativeY,
                footprint,
                containerRect,
                gridCellsX,
                gridCellsY,
                tokenSnapToGrid
            );

            setCurrentPos(displayPixels);
            const updatedEntry = { ...entry, mapPosition: newMapPosition };
            pendingUpdateRef.current = updatedEntry;
            liveSync.throttledLive(updatedEntry);
        },
        [entry, footprint, getContainerRect, gridCellsX, gridCellsY, tokenSnapToGrid, liveSync]
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            applyDragAtClient(e.clientX, e.clientY);
        },
        [applyDragAtClient]
    );

    const handleMouseUp = useCallback(
        (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            e.preventDefault();
            applyDragAtClient(e.clientX, e.clientY);
            const finalEntry = pendingUpdateRef.current;
            if (finalEntry) {
                liveSync.commit(finalEntry);
                if (finalEntry.mapPosition) {
                    onMovementStop?.(finalEntry.mapPosition);
                }
            }
            pendingUpdateRef.current = null;
            setIsDragging(false);
            isDraggingRef.current = false;
            document.body.classList.remove('dragging-token');
        },
        [applyDragAtClient, liveSync, onMovementStop]
    );

    useEffect(() => {
        if (!isDragging) {
            return;
        }

        window.addEventListener('mousemove', handleMouseMove, { capture: true });
        window.addEventListener('mouseup', handleMouseUp, { capture: true });
        return () => {
            window.removeEventListener('mousemove', handleMouseMove, { capture: true });
            window.removeEventListener('mouseup', handleMouseUp, { capture: true });
            document.body.classList.remove('dragging-token');
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

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
        let mapPosition = entry.mapPosition;
        if (mapPosition) {
            const containerRect = getContainerRect();
            const display = tokenMapPositionToDisplayPixels(
                mapPosition,
                containerRect,
                gridCellsX,
                gridCellsY
            );
            const { mapPosition: snapped } = pointerToTokenPosition(
                display.x,
                display.y,
                newFootprint,
                containerRect,
                gridCellsX,
                gridCellsY,
                tokenSnapToGrid
            );
            mapPosition = snapped;
        }
        onUpdate({
            ...entry,
            tokenFootprint: newFootprint,
            tokenSize: undefined,
            mapPosition,
        });
        setContextMenu(null);
        if (closeOtherTokenMenus === closeThisMenu) {
            closeOtherTokenMenus = null;
        }
    };

    useEffect(() => {
        if (!onMovementPreviewChange || !entry.isCurrentTurn) {
            return;
        }
        if (isDragging && movementPath?.length) {
            onMovementPreviewChange(
                displayPixelsToMeasurePoint(currentPos, getContainerRect())
            );
        } else {
            onMovementPreviewChange(null);
        }
    }, [
        isDragging,
        currentPos,
        movementPath,
        onMovementPreviewChange,
        entry.isCurrentTurn,
        getContainerRect,
    ]);

    const openContextMenu = (clientX: number, clientY: number) => {
        closeOtherTokenMenus?.();
        closeOtherTokenMenus = closeThisMenu;
        setContextMenu({ x: clientX, y: clientY });
    };

    const resetToTurnStart = () => {
        if (!movementPath?.length) {
            return;
        }
        const start = structuredClone(movementPath[0]);
        const updatedEntry = { ...entry, mapPosition: start };
        onUpdate(updatedEntry);
        liveSync.commit(updatedEntry);
        onResetMovement?.();
        setContextMenu(null);
        if (closeOtherTokenMenus === closeThisMenu) {
            closeOtherTokenMenus = null;
        }
    };

    const canResetMovement = Boolean(movementPath && movementPath.length > 1);

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

    const showTurnRipple = entry.isCurrentTurn && !entry.isKilled;
    const rippleBorderClass = entry.isPlayer ? 'border-primary' : 'border-destructive';

    const half = tokenDiameter / 2;

    const zIndex = isDragging
        ? entry.isCurrentTurn
            ? COMBATANT_TOKEN_Z_INDEX.currentTurnDragging
            : COMBATANT_TOKEN_Z_INDEX.dragging
        : entry.isCurrentTurn
          ? COMBATANT_TOKEN_Z_INDEX.currentTurn
          : COMBATANT_TOKEN_Z_INDEX.default;

    return (
        <div
            ref={tokenRef}
            className={cn(
                'absolute select-none',
                isAdmin && 'cursor-grab active:cursor-grabbing'
            )}
            style={{
                left: currentPos.x - half,
                top: currentPos.y - half,
                width: tokenDiameter,
                height: tokenDiameter,
                zIndex,
            }}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
            onClick={(e) => e.stopPropagation()}
            title={isAdmin ? 'Right-click for token options' : undefined}
        >
            {showTurnRipple && (
                <div
                    key={`ripple-${entry.isPlayer ? 'player' : 'enemy'}-${footprint}-${Math.round(tokenDiameter)}`}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
                    aria-hidden
                >
                    <div
                        className={cn(
                            'absolute inset-0 rounded-full border-2 animate-combatant-ripple-1',
                            rippleBorderClass
                        )}
                    />
                    <div
                        className={cn(
                            'absolute inset-0 rounded-full border-2 animate-combatant-ripple-2',
                            rippleBorderClass
                        )}
                    />
                    <div
                        className={cn(
                            'absolute inset-0 rounded-full border-2 animate-combatant-ripple-3',
                            rippleBorderClass
                        )}
                    />
                </div>
            )}

            <div
                className={cn(
                    'relative flex h-full w-full flex-col items-center justify-center rounded-full border-2 bg-background/80 shadow-md backdrop-blur-sm',
                    entry.isPlayer
                        ? 'border-primary text-primary'
                        : 'border-destructive text-destructive',
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
                        {canResetMovement && (
                            <>
                                <div className="my-1 h-px bg-border" />
                                <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Movement
                                </p>
                                <button
                                    type="button"
                                    className="flex w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                                    onClick={resetToTurnStart}
                                >
                                    Reset to turn start
                                </button>
                            </>
                        )}
                    </div>,
                    document.body
                )}
        </div>
    );
});
