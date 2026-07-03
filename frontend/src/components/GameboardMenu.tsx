import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
    MousePointer,
    ZapIcon,
    SunIcon,
    MoonIcon,
    Ruler,
    Target,
    CloudLightning,
    EyeOff,
    X,
} from 'lucide-react';
import { GameboardDock } from '@/components/gameboard/GameboardDock';
import { websocketService } from '../services/websocket';
import type { Scene } from '@/types/map';
import { MeasureOverlay } from './MeasureOverlay';
import { getPlayAreaRect } from '@/utils/aoeCoordinates';
import {
    isLegacyMeasurePoint,
    legacyMeasurePointToNormalized,
    measurePointToContainerPixels,
    migrateMeasurePoints,
    pathLengthFeet,
    pointerToMeasurePoint,
    type MeasurePoint,
} from '@/utils/measureDistance';
import { playAreaLayerZIndex } from '@/utils/playAreaLayers';

interface GameboardMenuProps {
    connectionStatus: string;
    gridSettings: Scene['gridSettings'];
    playAreaRef: React.RefObject<HTMLDivElement | null>;
    mapCount: number;
    isViewerBlanked: boolean;
    onToggleViewerBlank: () => void;
    isDarkMode: boolean;
    brightness: number;
    applyNightMode: (enabled: boolean, brightness: number) => void;
    onActiveToolChange?: (tool: string) => void;
}

function isClickInPlayArea(
    target: HTMLElement,
    playAreaRef: React.RefObject<HTMLDivElement | null>
): boolean {
    return playAreaRef.current?.contains(target) ?? false;
}

function isClickOnUiElement(target: HTMLElement): boolean {
    return Boolean(
        target.closest('button') ||
            target.closest('[role="button"]') ||
            target.closest('[role="menu"]') ||
            target.closest('[role="menuitem"]') ||
            target.closest('.dropdown') ||
            target.closest('input') ||
            target.closest('select') ||
            target.closest('a') ||
            target.closest('menu') ||
            target.closest('label') ||
            target.closest('[data-ui-element="true"]') ||
            target.closest('[data-gameboard-ui]') ||
            target.closest('[data-radix-popper-content-wrapper]')
    );
}

export const GameboardMenu: React.FC<GameboardMenuProps> = ({
    connectionStatus,
    gridSettings,
    playAreaRef,
    mapCount,
    isViewerBlanked,
    onToggleViewerBlank,
    isDarkMode,
    brightness,
    applyNightMode,
    onActiveToolChange,
}) => {
    const [activeTool, setActiveTool] = useState<string>('pointer');
    const [showRipple, setShowRipple] = useState(false);
    const [ripplePosition, setRipplePosition] = useState<MeasurePoint>({ x: 0, y: 0 });
    const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
    const [isShaking, setIsShaking] = useState(false);
    const [justActivatedMarker, setJustActivatedMarker] = useState(false);
    const [justActivatedMeasure, setJustActivatedMeasure] = useState(false);
    const [layoutTick, setLayoutTick] = useState(0);

    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleResize = () => setLayoutTick((n) => n + 1);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setLayoutTick((n) => n + 1);
    }, [playAreaRef]);

    const playAreaRect = useMemo(
        () => getPlayAreaRect(playAreaRef.current),
        [playAreaRef, layoutTick]
    );

    const totalMeasureFeet = useMemo(
        () => pathLengthFeet(measurePoints, gridSettings, playAreaRect),
        [measurePoints, gridSettings, playAreaRect]
    );

    const rippleDisplayPosition = useMemo(
        () => measurePointToContainerPixels(ripplePosition, playAreaRect),
        [ripplePosition, playAreaRect]
    );

    const broadcastSceneEvent = useCallback(
        (eventType: string, extra: Record<string, unknown> = {}) => {
            websocketService.send({
                type: 'scene_event',
                eventType,
                ...extra,
            });
        },
        []
    );

    const clearMeasurePoints = useCallback(
        (broadcast = true) => {
            setMeasurePoints([]);
            if (broadcast) {
                broadcastSceneEvent('measure_clear');
            }
        },
        [broadcastSceneEvent]
    );

    const applyMeasurePoints = useCallback(
        (points: MeasurePoint[], broadcast = true) => {
            const normalized = migrateMeasurePoints(
                points,
                getPlayAreaRect(playAreaRef.current)
            );
            setMeasurePoints(normalized);
            if (broadcast) {
                broadcastSceneEvent('measure_update', { points: normalized });
            }
        },
        [broadcastSceneEvent, playAreaRef]
    );

    const createRippleEffect = useCallback(
        (point: MeasurePoint, broadcast = true) => {
            const normalized = isLegacyMeasurePoint(point)
                ? legacyMeasurePointToNormalized(
                      point,
                      getPlayAreaRect(playAreaRef.current)
                  )
                : point;
            setRipplePosition(normalized);
            setShowRipple(true);

            setTimeout(() => {
                setShowRipple(false);
            }, 3000);

            if (broadcast) {
                broadcastSceneEvent('ripple_effect', {
                    x: normalized.x,
                    y: normalized.y,
                });
            }
        },
        [broadcastSceneEvent, playAreaRef]
    );

    const toggleLightningEffect = useCallback((broadcast = true) => {
        if (typeof document !== 'undefined') {
            const lightning = document.createElement('div');
            lightning.className = 'fixed inset-0 bg-white/30 z-[900] pointer-events-none';
            document.body.appendChild(lightning);

            setTimeout(() => {
                lightning.className = 'fixed inset-0 bg-white/10 z-[900] pointer-events-none';
                setTimeout(() => {
                    lightning.className = 'fixed inset-0 bg-white/60 z-[900] pointer-events-none';
                    setTimeout(() => {
                        lightning.className = 'fixed inset-0 bg-white/20 z-[900] pointer-events-none';
                        setTimeout(() => {
                            document.body.removeChild(lightning);
                        }, 100);
                    }, 50);
                }, 80);
            }, 40);

            if (broadcast) {
                broadcastSceneEvent('lightning_effect');
            }
        }
    }, [broadcastSceneEvent]);

    const toggleShakeEffect = useCallback((broadcast = true) => {
        setIsShaking(true);

        if (broadcast) {
            broadcastSceneEvent('shake_effect');
        }
    }, [broadcastSceneEvent]);

    useEffect(() => {
        const handleRemoteEvents = (data: {
            type?: string;
            eventType?: string;
            x?: number;
            y?: number;
            enabled?: boolean;
            brightness?: number;
            points?: MeasurePoint[];
        }) => {
            if (data.type === 'scene_event') {
                if (data.eventType === 'ripple_effect') {
                    createRippleEffect(
                        { x: data.x ?? 0, y: data.y ?? 0 },
                        false
                    );
                } else if (data.eventType === 'lightning_effect') {
                    toggleLightningEffect(false);
                } else if (data.eventType === 'shake_effect') {
                    toggleShakeEffect(false);
                } else if (data.eventType === 'measure_update') {
                    if (Array.isArray(data.points)) {
                        applyMeasurePoints(data.points, false);
                    }
                } else if (data.eventType === 'measure_clear') {
                    clearMeasurePoints(false);
                }
            }
        };

        const unsubscribe = websocketService.addListener(handleRemoteEvents);

        return () => {
            unsubscribe();
        };
    }, [
        createRippleEffect,
        toggleLightningEffect,
        toggleShakeEffect,
        applyMeasurePoints,
        clearMeasurePoints,
    ]);

    useEffect(() => {
        if (isShaking && typeof document !== 'undefined') {
            document.body.classList.add('shake-effect');

            const timer = setTimeout(() => {
                document.body.classList.remove('shake-effect');
                setIsShaking(false);
            }, 1000);

            return () => {
                clearTimeout(timer);
                document.body.classList.remove('shake-effect');
            };
        }
    }, [isShaking]);

    useEffect(() => {
        onActiveToolChange?.(activeTool);
    }, [activeTool, onActiveToolChange]);

    useEffect(() => {
        const handleDocumentClick = (e: MouseEvent) => {
            if (activeTool !== 'marker') return;

            if (justActivatedMarker) {
                setJustActivatedMarker(false);
                return;
            }

            const target = e.target as HTMLElement;
            if (
                isClickInPlayArea(target, playAreaRef) &&
                !isClickOnUiElement(target)
            ) {
                const rect = getPlayAreaRect(playAreaRef.current);
                createRippleEffect(pointerToMeasurePoint(e.clientX, e.clientY, rect));
                e.stopPropagation();
            }
        };

        if (activeTool === 'marker') {
            document.addEventListener('click', handleDocumentClick);
            document.body.style.cursor = 'crosshair';
        }

        return () => {
            document.removeEventListener('click', handleDocumentClick);
            if (activeTool === 'marker') {
                document.body.style.cursor = '';
            }
        };
    }, [activeTool, justActivatedMarker, createRippleEffect, playAreaRef]);

    useEffect(() => {
        const handleDocumentClick = (e: MouseEvent) => {
            if (activeTool !== 'measure') return;

            if (justActivatedMeasure) {
                setJustActivatedMeasure(false);
                return;
            }

            const target = e.target as HTMLElement;
            if (
                isClickInPlayArea(target, playAreaRef) &&
                !isClickOnUiElement(target)
            ) {
                const rect = getPlayAreaRect(playAreaRef.current);
                const nextPoint = pointerToMeasurePoint(e.clientX, e.clientY, rect);
                setMeasurePoints((prev) => {
                    const next = [...prev, nextPoint];
                    broadcastSceneEvent('measure_update', { points: next });
                    return next;
                });
                e.stopPropagation();
            }
        };

        if (activeTool === 'measure') {
            document.addEventListener('click', handleDocumentClick);
            document.body.style.cursor = 'crosshair';
        }

        return () => {
            document.removeEventListener('click', handleDocumentClick);
            if (activeTool === 'measure') {
                document.body.style.cursor = '';
            }
        };
    }, [activeTool, justActivatedMeasure, broadcastSceneEvent, playAreaRef]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || activeTool !== 'measure') return;
            clearMeasurePoints();
        };

        if (activeTool === 'measure') {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeTool, clearMeasurePoints]);

    const toggleDayNight = () => {
        const nextEnabled = !isDarkMode;
        applyNightMode(nextEnabled, brightness);
    };

    const handleBrightnessChange = (value: number) => {
        applyNightMode(true, value);
    };

    const exitRippleMode = () => {
        setActiveTool('pointer');
    };

    const exitMeasureMode = () => {
        setActiveTool('pointer');
    };

    const selectPointerTool = () => {
        setActiveTool('pointer');
    };

    const selectMarkerTool = () => {
        setActiveTool('marker');
        setJustActivatedMarker(true);
    };

    const selectMeasureTool = () => {
        setActiveTool('measure');
        setJustActivatedMeasure(true);
    };

    const toolDockItems = useMemo(
        () => [
            {
                id: 'pointer',
                label: 'Pointer',
                icon: <MousePointer className="h-4 w-4" />,
                active: activeTool === 'pointer',
                onClick: selectPointerTool,
            },
            {
                id: 'marker',
                label: 'Marker (ripple)',
                icon: <Target className="h-4 w-4" />,
                active: activeTool === 'marker',
                onClick: selectMarkerTool,
            },
            {
                id: 'measure',
                label: 'Measure (ft)',
                icon: <Ruler className="h-4 w-4" />,
                active: activeTool === 'measure',
                onClick: selectMeasureTool,
            },
        ],
        [activeTool]
    );

    const effectDockItems = useMemo(
        () => [
            {
                id: 'lightning',
                label: 'Lightning flash',
                icon: <CloudLightning className="h-4 w-4" />,
                onClick: () => toggleLightningEffect(),
            },
            {
                id: 'shake',
                label: 'Shake board',
                icon: <ZapIcon className="h-4 w-4" />,
                onClick: () => toggleShakeEffect(),
            },
            {
                id: 'blank-viewer',
                label: isViewerBlanked ? 'Unblank viewer' : 'Blank viewer',
                icon: <EyeOff className="h-4 w-4" />,
                active: isViewerBlanked,
                onClick: onToggleViewerBlank,
            },
        ],
        [toggleLightningEffect, toggleShakeEffect, isViewerBlanked, onToggleViewerBlank]
    );

    const nightDockItems = useMemo(
        () => [
            {
                id: 'night',
                label: isDarkMode ? 'Day mode' : 'Night mode',
                icon: isDarkMode ? (
                    <SunIcon className="h-4 w-4" />
                ) : (
                    <MoonIcon className="h-4 w-4" />
                ),
                active: isDarkMode,
                onClick: toggleDayNight,
            },
        ],
        [isDarkMode, toggleDayNight]
    );

    const showMeasureOverlay =
        activeTool === 'measure' || measurePoints.length > 0;

    const measureZ = playAreaLayerZIndex(mapCount, 'measureOverlay');
    const playAreaPortalTarget = playAreaRef.current;

    const playAreaEffects =
        playAreaPortalTarget &&
        createPortal(
            <>
                {showMeasureOverlay && (
                    <MeasureOverlay
                        points={measurePoints}
                        totalFeet={totalMeasureFeet}
                        containerRef={playAreaRef}
                        showEmptyHint={activeTool === 'measure'}
                        zIndex={measureZ}
                    />
                )}

                {showRipple && (
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            zIndex: measureZ,
                            left: rippleDisplayPosition.x,
                            top: rippleDisplayPosition.y,
                        }}
                    >
                        <div
                            className="absolute rounded-full animate-ripple-1"
                            style={{
                                width: '80px',
                                height: '80px',
                                border: '2px solid #4ade80',
                                transform: 'translate(-50%, -50%)',
                                opacity: 0.9,
                            }}
                        />
                        <div
                            className="absolute rounded-full animate-ripple-2"
                            style={{
                                width: '110px',
                                height: '110px',
                                border: '2px solid #4ade80',
                                transform: 'translate(-50%, -50%)',
                                opacity: 0.7,
                                animationDelay: '0.5s',
                            }}
                        />
                        <div
                            className="absolute rounded-full animate-ripple-3"
                            style={{
                                width: '140px',
                                height: '140px',
                                border: '2px solid #4ade80',
                                transform: 'translate(-50%, -50%)',
                                opacity: 0.5,
                                animationDelay: '1s',
                            }}
                        />
                    </div>
                )}
            </>,
            playAreaPortalTarget
        );

    return (
        <>
            <div
                ref={menuRef}
                className="absolute top-4 left-1/2 z-[1002] flex -translate-x-1/2 flex-col items-center gap-1"
                data-ui-element="true"
            >
                <div className="flex items-center gap-2">
                    <GameboardDock items={toolDockItems} />
                    <div className="h-6 w-px bg-border/50" aria-hidden />
                    <GameboardDock items={effectDockItems} />
                    <GameboardDock items={nightDockItems} />
                    <div
                        className="glass-panel flex h-9 w-9 items-center justify-center rounded-full"
                        title={
                            connectionStatus === 'connected'
                                ? 'Connected'
                                : connectionStatus
                        }
                    >
                        {connectionStatus === 'connected' ? (
                            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                        ) : (
                            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                        )}
                    </div>
                </div>
                {isDarkMode && (
                    <div className="glass-panel flex w-56 items-center gap-2 rounded-full px-3 py-1.5">
                        <span className="shrink-0 text-xs text-muted-foreground">
                            {brightness}%
                        </span>
                        <input
                            type="range"
                            min={10}
                            max={100}
                            value={brightness}
                            onChange={(e) =>
                                handleBrightnessChange(parseInt(e.target.value, 10))
                            }
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary"
                            aria-label="Night mode brightness"
                        />
                    </div>
                )}
            </div>

            {activeTool === 'marker' && (
                <div className="glass-panel fixed bottom-4 left-1/2 z-[1002] -translate-x-1/2 rounded-md px-4 py-2">
                    <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="text-xs text-foreground">Click anywhere to create a ripple marker</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={exitRippleMode}
                        >
                            <X className="h-3 w-3 text-muted-foreground" />
                        </Button>
                    </div>
                </div>
            )}

            {activeTool === 'measure' && (
                <div className="glass-panel fixed bottom-4 left-1/2 z-[1002] -translate-x-1/2 rounded-md px-4 py-2">
                    <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-primary" />
                        <span className="text-xs text-foreground">
                            Click to add points · Esc to clear
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={exitMeasureMode}
                        >
                            <X className="h-3 w-3 text-muted-foreground" />
                        </Button>
                    </div>
                </div>
            )}

            {playAreaEffects}
        </>
    );
};
