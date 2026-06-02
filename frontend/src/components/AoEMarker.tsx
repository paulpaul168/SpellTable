import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, memo, RefObject, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AoEMarker as AoEMarkerType } from '../types/map';
import {
    getPlayAreaRect,
    pointerToAoEPosition,
    toDisplayPixels,
} from '@/utils/aoeCoordinates';
import { AoEEffectSprite } from './AoEEffectSprite';
import { AoEEffectVideo } from './AoEEffectVideo';
import { normalizeAoEEffectTheme, prefetchAoEEffectMeta } from '@/lib/aoeEffects';
import type { AoEEffectTheme } from '@/types/aoeEffect';
import { DEFAULT_AOE_EFFECT_THEME } from '@/types/aoeEffect';
import { createThrottledLiveSync, type LiveSyncOptions } from '@/utils/liveSync';

interface AoEMarkerProps {
    marker: AoEMarkerType;
    gridSize: number;
    isActive: boolean;
    isAdmin: boolean;
    onUpdate: (updatedMarker: AoEMarkerType, options?: LiveSyncOptions) => void;
    onDelete: (markerId: string) => void;
    scale?: number;
    gridSettings?: {
        useFixedGrid?: boolean;
        gridCellsX?: number;
        gridCellsY?: number;
        gridSize: number;
        aoeSnapToGrid?: boolean;
        aoeEffectTheme?: AoEEffectTheme;
        aoeStagedReveal?: boolean;
    };
    isHighlighted?: boolean;
    containerRef?: RefObject<HTMLElement | null>;
    onTrigger?: (markerId: string) => void;
    onReset?: (markerId: string) => void;
}

let closeOtherAoEMenus: (() => void) | null = null;

export const AoEMarker = memo(function AoEMarker({
    marker,
    gridSize,
    isActive,
    isAdmin,
    onUpdate,
    onDelete,
    scale = 1,
    gridSettings,
    isHighlighted = false,
    containerRef,
    onTrigger,
    onReset,
}: AoEMarkerProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showSizeIndicator, setShowSizeIndicator] = useState(false);
    const [highlightAnimation, setHighlightAnimation] = useState(false);
    const [highlightRippleKey, setHighlightRippleKey] = useState(0);
    const [effectLoaded, setEffectLoaded] = useState(false);
    const [playRevealAnimation, setPlayRevealAnimation] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const prevRevealedRef = useRef(marker.revealed);
    const revealWaitingForEffectRef = useRef(false);
    const pendingUpdateRef = useRef<AoEMarkerType | null>(null);
    const mouseDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const markerRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef(marker.position);
    const isDraggingRef = useRef(false);
    const isRotatingRef = useRef(false);
    const rotateOffsetRef = useRef(0);
    const rotateHandleAngleRef = useRef(0);
    const ctrlHeldRef = useRef(false);
    const lastPointerClientRef = useRef({ x: 0, y: 0 });
    const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [localRotation, setLocalRotation] = useState<number | null>(null);
    const pendingRotationRef = useRef<number | null>(null);

    const useFixedGrid = gridSettings?.useFixedGrid || false;
    const gridCellsX = gridSettings?.gridCellsX || 25;
    const gridCellsY = gridSettings?.gridCellsY || 13;

    const getContainerRect = useCallback(() => {
        return getPlayAreaRect(containerRef?.current ?? null);
    }, [containerRef]);

    const getCellSizes = useCallback((containerRect: DOMRect) => {
        return {
            cellWidth: containerRect.width / gridCellsX,
            cellHeight: containerRect.height / gridCellsY,
        };
    }, [gridCellsX, gridCellsY]);

    const { cellWidth, cellHeight } = getCellSizes(getContainerRect());

    const effectiveGridSize = useFixedGrid
        ? Math.min(cellWidth, cellHeight)
        : gridSize;

    const aoeSnapToGrid = gridSettings?.aoeSnapToGrid !== false;
    const aoeEffectTheme = normalizeAoEEffectTheme(
        gridSettings?.aoeEffectTheme ?? DEFAULT_AOE_EFFECT_THEME,
    );
    const aoeStagedReveal = gridSettings?.aoeStagedReveal === true;
    const isHiddenFromViewer = !isAdmin && aoeStagedReveal && marker.revealed === false;
    const canTrigger =
        isAdmin && aoeStagedReveal && marker.revealed === false && onTrigger;
    const canReset =
        isAdmin && aoeStagedReveal && marker.revealed === true && onReset;
    const canOpenStagedMenu = canTrigger || canReset;

    const sizeInPixels = marker.sizeInFeet * effectiveGridSize / 5;
    const adjustedSizeInPixels = sizeInPixels;

    const getRotationPivot = useCallback((): { x: number; y: number } => {
        const center = positionRef.current;
        if (marker.shape === 'line') {
            const rotRad = (marker.rotation * Math.PI) / 180;
            return {
                x: center.x - (adjustedSizeInPixels / 2) * Math.cos(rotRad),
                y: center.y - (adjustedSizeInPixels / 2) * Math.sin(rotRad),
            };
        }
        return center;
    }, [marker.shape, marker.rotation, adjustedSizeInPixels]);

    useEffect(() => {
        if (marker.effectId && aoeEffectTheme !== 'none') {
            prefetchAoEEffectMeta(marker.effectId, aoeEffectTheme);
            setEffectLoaded(false);
        }
    }, [marker.effectId, aoeEffectTheme]);

    useEffect(() => {
        if (isHighlighted) {
            queueMicrotask(() => {
                setHighlightRippleKey((k) => k + 1);
                setHighlightAnimation(true);
            });

            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }

            highlightTimerRef.current = setTimeout(() => {
                setHighlightAnimation(false);
                highlightTimerRef.current = null;
            }, 3500);
        }
    }, [isHighlighted]);

    useLayoutEffect(() => {
        if (!aoeStagedReveal) {
            prevRevealedRef.current = marker.revealed;
            return;
        }
        const wasUnrevealed = prevRevealedRef.current === false;
        const nowRevealed = marker.revealed !== false;
        if (wasUnrevealed && nowRevealed && !isAdmin) {
            setPlayRevealAnimation(true);
        }
        if (marker.revealed === false) {
            revealWaitingForEffectRef.current = false;
            setPlayRevealAnimation(false);
        }
        prevRevealedRef.current = marker.revealed;
    }, [marker.revealed, aoeStagedReveal, isAdmin]);

    useEffect(() => {
        if (revealWaitingForEffectRef.current && effectLoaded) {
            revealWaitingForEffectRef.current = false;
            setPlayRevealAnimation(false);
        }
    }, [effectLoaded]);

    const closeThisMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    useEffect(() => {
        return () => {
            if (closeOtherAoEMenus === closeThisMenu) {
                closeOtherAoEMenus = null;
            }
        };
    }, [closeThisMenu]);

    useEffect(() => {
        if (!contextMenu) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (e.button === 2) return;
            const target = e.target as Node;
            if (markerRef.current?.contains(target)) return;
            if (
                target instanceof Element &&
                target.closest('[data-aoe-context-menu]')
            ) {
                return;
            }
            setContextMenu(null);
        };

        const handleScroll = () => setContextMenu(null);
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null);
        };

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

    useEffect(() => {
        return () => {
            if (resizeTimerRef.current) {
                clearTimeout(resizeTimerRef.current);
            }
            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }
        };
    }, []);

    const calculatePosition = useCallback(() => {
        const containerRect = getContainerRect();
        return toDisplayPixels(marker, gridSettings, containerRect, gridCellsX, gridCellsY);
    }, [marker, gridSettings, getContainerRect, gridCellsX, gridCellsY]);

    const [currentPos, setCurrentPos] = useState(calculatePosition());

    useEffect(() => {
        positionRef.current = currentPos;
    }, [currentPos]);

    useEffect(() => {
        if (isDraggingRef.current) {
            return;
        }

        const updatePosition = () => {
            const newPosition = calculatePosition();
            setCurrentPos(newPosition);
            positionRef.current = newPosition;
        };

        updatePosition();

        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('resize', updatePosition);
        };
    }, [marker.position, marker.useGridCoordinates, calculatePosition]);

    const displayRotation = localRotation ?? marker.rotation;

    const liveSync = useMemo(() => createThrottledLiveSync(onUpdate), [onUpdate]);
    const rotateLiveSync = useMemo(() => createThrottledLiveSync(onUpdate), [onUpdate]);

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

            setCurrentPos(displayPixels);
            positionRef.current = displayPixels;
            pendingUpdateRef.current = {
                ...marker,
                position,
                useGridCoordinates,
            };
            liveSync.throttledLive(pendingUpdateRef.current);
        },
        [marker, getContainerRect, gridCellsX, gridCellsY, aoeSnapToGrid, liveSync]
    );

    const applyRotateAtClient = useCallback(
        (clientX: number, clientY: number, syncLive = false) => {
            const containerRect = getContainerRect();
            const pivot = getRotationPivot();
            const pointerX = clientX - containerRect.left;
            const pointerY = clientY - containerRect.top;
            const pointerAngleDeg =
                Math.atan2(pointerY - pivot.y, pointerX - pivot.x) * (180 / Math.PI);
            let newRotation =
                pointerAngleDeg - rotateHandleAngleRef.current + rotateOffsetRef.current;
            newRotation = ((newRotation % 360) + 360) % 360;
            const rounded = Math.round(newRotation);
            pendingRotationRef.current = rounded;
            setLocalRotation(rounded);
            if (syncLive) {
                rotateLiveSync.throttledLive({
                    ...marker,
                    rotation: rounded,
                });
            }
        },
        [getContainerRect, getRotationPivot, marker, rotateLiveSync]
    );

    const handleRotateMove = useCallback(
        (e: MouseEvent) => {
            if (!isRotatingRef.current) return;

            e.preventDefault();
            e.stopPropagation();
            applyRotateAtClient(e.clientX, e.clientY, true);
        },
        [applyRotateAtClient]
    );

    const handleRotateUp = useCallback(
        (e: MouseEvent) => {
            if (!isRotatingRef.current) return;

            e.preventDefault();
            applyRotateAtClient(e.clientX, e.clientY, false);
            const nextRotation = pendingRotationRef.current ?? marker.rotation;
            rotateLiveSync.commit({
                ...marker,
                rotation: nextRotation,
            });
            pendingRotationRef.current = null;
            setLocalRotation(null);
            setIsRotating(false);
            isRotatingRef.current = false;
            document.body.classList.remove('dragging-aoe');
        },
        [applyRotateAtClient, marker, rotateLiveSync]
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDraggingRef.current) return;

            e.preventDefault();
            e.stopPropagation();

            lastPointerClientRef.current = { x: e.clientX, y: e.clientY };
            ctrlHeldRef.current = e.ctrlKey;
            applyDragAtClient(e.clientX, e.clientY, e.ctrlKey);
        },
        [applyDragAtClient]
    );

    const handleMouseUp = useCallback(
        (e: MouseEvent) => {
            if (!isDraggingRef.current) return;

            e.preventDefault();

            const containerRect = getContainerRect();
            const containerRelativeX =
                e.clientX - containerRect.left - mouseDragOffsetRef.current.x;
            const containerRelativeY =
                e.clientY - containerRect.top - mouseDragOffsetRef.current.y;
            const snapDisplay = aoeSnapToGrid || e.ctrlKey;
            const { position, useGridCoordinates, displayPixels } = pointerToAoEPosition(
                containerRelativeX,
                containerRelativeY,
                snapDisplay,
                aoeSnapToGrid,
                containerRect,
                gridCellsX,
                gridCellsY
            );
            const finalMarker: AoEMarkerType =
                pendingUpdateRef.current ?? {
                    ...marker,
                    position,
                    useGridCoordinates,
                };

            liveSync.commit(finalMarker);
            pendingUpdateRef.current = null;
            setCurrentPos(displayPixels);
            positionRef.current = displayPixels;

            setIsDragging(false);
            isDraggingRef.current = false;
            ctrlHeldRef.current = false;
            document.body.classList.remove('dragging-aoe');
        },
        [marker, liveSync, getContainerRect, gridCellsX, gridCellsY, aoeSnapToGrid]
    );

    useEffect(() => {
        if (!isDragging && !isRotating) {
            return;
        }

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isRotatingRef.current) {
                handleRotateMove(e);
                return;
            }
            handleMouseMove(e);
        };
        const handleGlobalMouseUp = (e: MouseEvent) => {
            if (isRotatingRef.current) {
                handleRotateUp(e);
                return;
            }
            handleMouseUp(e);
        };
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isRotatingRef.current) {
                    setIsRotating(false);
                    isRotatingRef.current = false;
                    pendingRotationRef.current = null;
                    setLocalRotation(null);
                    document.body.classList.remove('dragging-aoe');
                    return;
                }
                if (isDraggingRef.current) {
                    setIsDragging(false);
                    isDraggingRef.current = false;
                    ctrlHeldRef.current = false;
                    pendingUpdateRef.current = null;
                    document.body.classList.remove('dragging-aoe');
                    return;
                }
            }
            if (
                isDraggingRef.current &&
                !aoeSnapToGrid &&
                e.key === 'Control' &&
                !ctrlHeldRef.current
            ) {
                ctrlHeldRef.current = true;
                const { x, y } = lastPointerClientRef.current;
                applyDragAtClient(x, y, true);
            }
        };

        const handleGlobalKeyUp = (e: KeyboardEvent) => {
            if (
                isDraggingRef.current &&
                !aoeSnapToGrid &&
                e.key === 'Control' &&
                ctrlHeldRef.current
            ) {
                ctrlHeldRef.current = false;
                const { x, y } = lastPointerClientRef.current;
                applyDragAtClient(x, y, false);
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove, { capture: true });
        window.addEventListener('mouseup', handleGlobalMouseUp, { capture: true });
        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove, { capture: true });
            window.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true });
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('keyup', handleGlobalKeyUp);
            document.body.classList.remove('dragging-aoe');
        };
    }, [
        isDragging,
        isRotating,
        handleMouseMove,
        handleMouseUp,
        handleRotateMove,
        handleRotateUp,
        applyDragAtClient,
        aoeSnapToGrid,
    ]);

    useEffect(() => {
        isDraggingRef.current = isDragging;
        if (isDragging || isRotating) {
            document.body.classList.add('dragging-aoe');
        } else {
            document.body.classList.remove('dragging-aoe');
        }
    }, [isDragging, isRotating]);

    const handleRotateHandleMouseDown = (
        e: React.MouseEvent,
        handleLocalAngleDeg: number,
    ) => {
        if (!isActive || !isAdmin) return;

        e.stopPropagation();
        e.preventDefault();

        const containerRect = getContainerRect();
        const pivot = getRotationPivot();
        const pointerX = e.clientX - containerRect.left;
        const pointerY = e.clientY - containerRect.top;
        const pointerAngleDeg =
            Math.atan2(pointerY - pivot.y, pointerX - pivot.x) * (180 / Math.PI);

        rotateHandleAngleRef.current = handleLocalAngleDeg;
        rotateOffsetRef.current = marker.rotation - pointerAngleDeg + handleLocalAngleDeg;
        setIsRotating(true);
        isRotatingRef.current = true;
        document.body.classList.add('dragging-aoe');
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || !isAdmin) return;

        if (e.button === 2) {
            e.stopPropagation();
            return;
        }
        if (e.button !== 0) return;

        e.stopPropagation();
        e.preventDefault();

        const containerRect = getContainerRect();
        const display = toDisplayPixels(marker, gridSettings, containerRect, gridCellsX, gridCellsY);
        const mouseRelX = e.clientX - containerRect.left;
        const mouseRelY = e.clientY - containerRect.top;

        mouseDragOffsetRef.current = {
            x: mouseRelX - display.x,
            y: mouseRelY - display.y,
        };

        lastPointerClientRef.current = { x: e.clientX, y: e.clientY };
        ctrlHeldRef.current = e.ctrlKey;

        setIsDragging(true);
        isDraggingRef.current = true;
        document.body.classList.add('dragging-aoe');
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!isActive || !isAdmin) return;
        e.stopPropagation();
        e.preventDefault();

        if (!e.shiftKey) {
            setIsResizing(true);
            setShowSizeIndicator(true);

            if (resizeTimerRef.current) {
                clearTimeout(resizeTimerRef.current);
            }

            resizeTimerRef.current = setTimeout(() => {
                setIsResizing(false);
                setShowSizeIndicator(false);
                resizeTimerRef.current = null;
            }, 1500);
        }

        if (e.shiftKey) {
            const delta = e.deltaY > 0 ? -5 : 5;
            const newRotation = (marker.rotation + delta) % 360;

            onUpdate(
                {
                    ...marker,
                    rotation: newRotation
                },
                { debounce: true },
            );
        } else {
            const delta = e.deltaY > 0 ? -5 : 5;
            const newSize = Math.max(5, marker.sizeInFeet + delta);

            onUpdate(
                {
                    ...marker,
                    sizeInFeet: newSize
                },
                { debounce: true },
            );
        }
    };

    const effectHeight =
        marker.shape === 'line'
            ? effectiveGridSize / 2
            : adjustedSizeInPixels;

    const effectWidth = adjustedSizeInPixels;
    const isCone = marker.shape === 'cone';
    const isLine = marker.shape === 'line';
    const isDirectional = isCone || isLine;

    const shapeBoundsStyle: React.CSSProperties = {
        position: 'relative',
        width: `${effectWidth}px`,
        height: `${effectHeight}px`,
    };

    const conePivotStyle: React.CSSProperties = {
        position: 'absolute',
        left: 0,
        top: 0,
        width: effectWidth,
        height: effectHeight,
        transform: `translate(-50%, 0) rotate(${displayRotation}deg)`,
        transformOrigin: '50% 0%',
    };

    const linePivotStyle: React.CSSProperties = {
        position: 'absolute',
        left: -effectWidth / 2,
        top: -effectHeight / 2,
        width: effectWidth,
        height: effectHeight,
        transform: `rotate(${displayRotation}deg)`,
        transformOrigin: '0% 50%',
    };

    const baseCenterHandleAngleDeg = Math.atan2(effectHeight, 0) * (180 / Math.PI);
    const lineEndHandleAngleDeg = 0;
    const showDirectionalRotationHandles = isAdmin && isActive && isDirectional;

    const renderDirectionalRotationHandles = () => {
        if (!showDirectionalRotationHandles) return null;

        const rotateHandleClass =
            'absolute z-20 h-3 w-3 rounded-full border-2 border-white shadow transition-opacity cursor-grab active:cursor-grabbing';
        const pivotDotClass =
            'pointer-events-none absolute z-20 h-2 w-2 rounded-full border border-black/60 bg-white shadow-sm';
        const handleOpacity = isHovered || isRotating || isDragging ? 1 : 0.75;

        if (isCone) {
            return (
                <>
                    <div
                        className={pivotDotClass}
                        style={{
                            left: effectWidth / 2,
                            top: 0,
                            transform: 'translate(-50%, -50%)',
                        }}
                        title="Rotation pivot"
                    />
                    <div
                        className={rotateHandleClass}
                        style={{
                            backgroundColor: marker.color,
                            opacity: handleOpacity,
                            left: effectWidth / 2,
                            top: effectHeight,
                            transform: 'translate(-50%, -50%)',
                        }}
                        title="Drag to rotate"
                        onMouseDown={(e) =>
                            handleRotateHandleMouseDown(e, baseCenterHandleAngleDeg)
                        }
                    />
                </>
            );
        }

        return (
            <>
                <div
                    className={pivotDotClass}
                    style={{
                        left: 0,
                        top: effectHeight / 2,
                        transform: 'translate(-50%, -50%)',
                    }}
                    title="Rotation pivot"
                />
                <div
                    className={rotateHandleClass}
                    style={{
                        backgroundColor: marker.color,
                        opacity: handleOpacity,
                        left: effectWidth,
                        top: effectHeight / 2,
                        transform: 'translate(-50%, -50%)',
                    }}
                    title="Drag to rotate"
                    onMouseDown={(e) =>
                        handleRotateHandleMouseDown(e, lineEndHandleAngleDeg)
                    }
                />
            </>
        );
    };

    const renderEffectSprite = () => {
        if (!marker.effectId || aoeEffectTheme === 'none') {
            return null;
        }
        return (
            <div
                className="pointer-events-none absolute left-0 top-0"
                style={{ width: effectWidth, height: effectHeight }}
            >
                {aoeEffectTheme === 'realistic' ? (
                    <AoEEffectVideo
                        effectId={marker.effectId}
                        theme={aoeEffectTheme}
                        shape={marker.shape}
                        width={effectWidth}
                        height={effectHeight}
                        opacity={marker.opacity}
                        onMetaLoaded={setEffectLoaded}
                    />
                ) : (
                    <AoEEffectSprite
                        effectId={marker.effectId}
                        theme={aoeEffectTheme}
                        shape={marker.shape}
                        width={effectWidth}
                        height={effectHeight}
                        opacity={marker.opacity}
                        tintColor={marker.color}
                        onMetaLoaded={setEffectLoaded}
                    />
                )}
            </div>
        );
    };

    const isRevealingViewer =
        aoeStagedReveal &&
        !isAdmin &&
        marker.revealed !== false &&
        (playRevealAnimation || prevRevealedRef.current === false);

    const getRevealClass = (): string => {
        if (!isRevealingViewer) return '';
        if (marker.shape === 'cone') return 'aoe-reveal-cone';
        if (marker.shape === 'line') return 'aoe-reveal-line';
        return 'aoe-reveal-center';
    };

    const handleRevealAnimationEnd = () => {
        const waitingForEffect =
            Boolean(marker.effectId) &&
            aoeEffectTheme !== 'none' &&
            !effectLoaded;
        if (waitingForEffect) {
            revealWaitingForEffectRef.current = true;
            return;
        }
        setPlayRevealAnimation(false);
    };

    const renderShape = () => {
        const showSolid =
            aoeEffectTheme === 'none' || !marker.effectId || !effectLoaded;
        return (
            <div style={shapeBoundsStyle}>
                {showSolid && renderSolidShape()}
                {renderEffectSprite()}
            </div>
        );
    };

    const renderLabel = () => {
        if (!marker.label) return null;
        return (
            <div
                className={`absolute px-2 py-1 bg-black/70 text-white text-xs rounded pointer-events-none${isRevealingViewer ? ' aoe-reveal-label' : ''}`}
                style={{
                    whiteSpace: 'nowrap',
                    top: `${effectHeight + 4}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                }}
            >
                {marker.label}
            </div>
        );
    };

    const renderRevealWrapped = (children: React.ReactNode) => {
        const revealClass = getRevealClass();
        if (!revealClass) return <>{children}</>;
        return (
            <div
                className={revealClass}
                style={{ width: effectWidth, height: effectHeight, position: 'relative' }}
                onAnimationEnd={handleRevealAnimationEnd}
            >
                {children}
            </div>
        );
    };

    const renderSolidShape = () => {
        switch (marker.shape) {
            case 'circle':
                return (
                    <div
                        className="rounded-full"
                        style={{
                            width: `${adjustedSizeInPixels}px`,
                            height: `${adjustedSizeInPixels}px`,
                            backgroundColor: marker.color,
                            opacity: marker.opacity
                        }}
                    />
                );
            case 'cone':
                return (
                    <svg
                        width={adjustedSizeInPixels}
                        height={adjustedSizeInPixels}
                        style={{ opacity: marker.opacity }}
                        viewBox={`0 0 ${adjustedSizeInPixels} ${adjustedSizeInPixels}`}
                    >
                        <polygon
                            points={`${adjustedSizeInPixels / 2},0 0,${adjustedSizeInPixels} ${adjustedSizeInPixels},${adjustedSizeInPixels}`}
                            fill={marker.color}
                        />
                    </svg>
                );
            case 'line':
                return (
                    <div
                        style={{
                            width: `${adjustedSizeInPixels}px`,
                            height: `${effectiveGridSize / 2}px`,
                            backgroundColor: marker.color,
                            opacity: marker.opacity
                        }}
                    />
                );
            case 'square':
            case 'cube':
                return (
                    <div
                        style={{
                            width: `${adjustedSizeInPixels}px`,
                            height: `${adjustedSizeInPixels}px`,
                            backgroundColor: marker.color,
                            opacity: marker.opacity
                        }}
                    />
                );
            case 'cylinder':
                return (
                    <div className="relative">
                        <div
                            className="rounded-full"
                            style={{
                                width: `${adjustedSizeInPixels}px`,
                                height: `${adjustedSizeInPixels}px`,
                                backgroundColor: marker.color,
                                opacity: marker.opacity
                            }}
                        />
                        <div
                            className="absolute top-1/4 left-1/4 rounded-full border-2"
                            style={{
                                width: `${adjustedSizeInPixels / 2}px`,
                                height: `${adjustedSizeInPixels / 2}px`,
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                                opacity: marker.opacity
                            }}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (!isAdmin) return;
        e.stopPropagation();
        onDelete(marker.id);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!isAdmin || !canOpenStagedMenu) return;
        e.preventDefault();
        e.stopPropagation();
        closeOtherAoEMenus?.();
        closeOtherAoEMenus = closeThisMenu;
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleTrigger = () => {
        onTrigger?.(marker.id);
        setContextMenu(null);
    };

    const handleReset = () => {
        onReset?.(marker.id);
        setContextMenu(null);
    };

    if (isHiddenFromViewer) {
        return null;
    }

    const markerContent = (
        <>
            {highlightAnimation && (
                <div key={highlightRippleKey}>
                    {isCone ? (
                        <svg
                            className="animate-aoe-highlight-ripple-cone-1"
                            width={adjustedSizeInPixels}
                            height={adjustedSizeInPixels + 30}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                            }}
                            viewBox={`${-adjustedSizeInPixels * 0.1} ${-adjustedSizeInPixels * 0.1} ${adjustedSizeInPixels * 1.2} ${adjustedSizeInPixels * 1.2 + 30}`}
                        >
                            <polygon
                                points={`${adjustedSizeInPixels / 2},0 ${-adjustedSizeInPixels * 0.1},${adjustedSizeInPixels * 1.1} ${adjustedSizeInPixels * 1.1},${adjustedSizeInPixels * 1.1}`}
                                fill="none"
                                stroke={marker.color}
                                strokeWidth="2"
                            />
                        </svg>
                    ) : (
                        <div
                            className={`absolute animate-aoe-highlight-ripple-1 ${marker.shape === 'circle' || marker.shape === 'cylinder' ? 'rounded-full' : ''}`}
                            style={{
                                width: `${adjustedSizeInPixels * 1.2}px`,
                                height: marker.shape === 'line' ? `${effectiveGridSize / 2 * 1.2}px` : `${adjustedSizeInPixels * 1.2}px`,
                                border: `2px solid ${marker.color}`,
                                transform: 'translate(-50%, -50%)',
                                left: '50%',
                                top: '50%',

                            }}
                        />
                    )}

                    {isCone ? (
                        <svg
                            className="animate-aoe-highlight-ripple-cone-2"
                            width={adjustedSizeInPixels}
                            height={adjustedSizeInPixels + 30}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                            }}
                            viewBox={`${-adjustedSizeInPixels * 0.2} ${-adjustedSizeInPixels * 0.2} ${adjustedSizeInPixels * 1.4} ${adjustedSizeInPixels * 1.4 + 30}`}
                        >
                            <polygon
                                points={`${adjustedSizeInPixels / 2},0 ${-adjustedSizeInPixels * 0.2},${adjustedSizeInPixels * 1.2} ${adjustedSizeInPixels * 1.2},${adjustedSizeInPixels * 1.2}`}
                                fill="none"
                                stroke={marker.color}
                                strokeWidth="2"
                            />
                        </svg>
                    ) : (
                        <div
                            className={`absolute animate-aoe-highlight-ripple-2 ${marker.shape === 'circle' || marker.shape === 'cylinder' ? 'rounded-full' : ''}`}
                            style={{
                                width: `${adjustedSizeInPixels * 1.4}px`,
                                height: marker.shape === 'line' ? `${effectiveGridSize / 2 * 1.4}px` : `${adjustedSizeInPixels * 1.4}px`,
                                border: `2px solid ${marker.color}`,
                                transform: 'translate(-50%, -50%)',
                                left: '50%',
                                top: '50%',

                            }}
                        />
                    )}

                    {isCone ? (
                        <svg
                            className="animate-aoe-highlight-ripple-cone-3"
                            width={adjustedSizeInPixels}
                            height={adjustedSizeInPixels + 30}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                            }}
                            viewBox={`${-adjustedSizeInPixels * 0.3} ${-adjustedSizeInPixels * 0.3} ${adjustedSizeInPixels * 1.6} ${adjustedSizeInPixels * 1.6 + 30}`}
                        >
                            <polygon
                                points={`${adjustedSizeInPixels / 2},0 ${-adjustedSizeInPixels * 0.3},${adjustedSizeInPixels * 1.3} ${adjustedSizeInPixels * 1.3},${adjustedSizeInPixels * 1.3}`}
                                fill="none"
                                stroke={marker.color}
                                strokeWidth="2"
                            />
                        </svg>
                    ) : (
                        <div
                            className={`absolute animate-aoe-highlight-ripple-3 ${marker.shape === 'circle' || marker.shape === 'cylinder' ? 'rounded-full' : ''}`}
                            style={{
                                width: `${adjustedSizeInPixels * 1.6}px`,
                                height: marker.shape === 'line' ? `${effectiveGridSize / 2 * 1.6}px` : `${adjustedSizeInPixels * 1.6}px`,
                                border: `2px solid ${marker.color}`,
                                transform: 'translate(-50%, -50%)',
                                left: '50%',
                                top: '50%',

                            }}
                        />
                    )}
                </div>
            )}

            {isAdmin && showSizeIndicator && (
                <div className={`absolute ${isCone ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full' : 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full'} mt-1 px-2 py-1 bg-black/80 text-white text-xs rounded pointer-events-none`}>
                    {marker.sizeInFeet}′
                </div>
            )}

            {renderRevealWrapped(renderShape())}

            {renderDirectionalRotationHandles()}

            {renderLabel()}
        </>
    );

    return (
        <div
            ref={markerRef}
            className={`absolute select-none ${highlightAnimation ? 'highlighted-marker' : ''}`}
            style={{
                position: 'absolute',
                left: `${currentPos.x}px`,
                top: `${currentPos.y}px`,
                width: isDirectional ? 0 : effectWidth,
                height: isDirectional ? 0 : effectHeight,
                transform: isDirectional
                    ? undefined
                    : `translate(-50%, -50%) rotate(${displayRotation}deg)`,
                transformOrigin: isDirectional ? undefined : 'center',
                cursor: isActive && isAdmin
                    ? (isDragging || isRotating ? 'grabbing' : 'grab')
                    : 'default',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: isDragging || isRotating ? 900 : 500,
                touchAction: 'none'
            }}
            title={canOpenStagedMenu ? 'Right-click for trigger / reset' : undefined}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onMouseEnter={() => !isDragging && setIsHovered(true)}
            onMouseLeave={() => !isDragging && setIsHovered(false)}
        >
            {isCone ? (
                <div style={conePivotStyle}>
                    {markerContent}
                </div>
            ) : isLine ? (
                <div style={linePivotStyle}>
                    {markerContent}
                </div>
            ) : (
                markerContent
            )}

            {contextMenu &&
                isAdmin &&
                createPortal(
                    <div
                        data-aoe-context-menu
                        role="menu"
                        className="fixed z-[10002] min-w-[11rem] overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        {canTrigger && (
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                                onClick={handleTrigger}
                            >
                                Trigger (reveal to viewers)
                            </button>
                        )}
                        {canReset && (
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                                onClick={handleReset}
                            >
                                Reset (hide from viewers)
                            </button>
                        )}
                    </div>,
                    document.body,
                )}

        </div>
    );
});
