import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    MousePointer,
    ZapIcon,
    SunIcon,
    MoonIcon,
    Ruler,
    Target,
    Wifi,
    CloudLightning,
    Menu,
    X
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { websocketService } from '../services/websocket';
import type { Scene } from '@/types/map';
import { MeasureOverlay } from './MeasureOverlay';
import {
    getGridCellDimensions,
    pathLengthFeet,
    type MeasurePoint,
} from '@/utils/measureDistance';

interface GameboardMenuProps {
    connectionStatus: string;
    gridSettings: Scene['gridSettings'];
}

function isClickOnUiElement(target: HTMLElement): boolean {
    return Boolean(
        target.closest('button') ||
            target.closest('[role="button"]') ||
            target.closest('.dropdown') ||
            target.closest('input') ||
            target.closest('select') ||
            target.closest('a') ||
            target.closest('menu') ||
            target.closest('label') ||
            target.closest('[data-ui-element="true"]')
    );
}

export const GameboardMenu: React.FC<GameboardMenuProps> = ({
    connectionStatus,
    gridSettings,
}) => {
    const [activeTool, setActiveTool] = useState<string>('pointer');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [brightness, setBrightness] = useState(100);
    const [showRipple, setShowRipple] = useState(false);
    const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
    const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
    const [isShaking, setIsShaking] = useState(false);
    const [justActivatedMarker, setJustActivatedMarker] = useState(false);
    const [justActivatedMeasure, setJustActivatedMeasure] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);

    const cellDims = useMemo(
        () => getGridCellDimensions(gridSettings),
        [gridSettings]
    );

    const totalMeasureFeet = useMemo(
        () => pathLengthFeet(measurePoints, cellDims),
        [measurePoints, cellDims]
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
            setMeasurePoints(points);
            if (broadcast) {
                broadcastSceneEvent('measure_update', { points });
            }
        },
        [broadcastSceneEvent]
    );

    const applyNightMode = useCallback(
        (enabled: boolean, nextBrightness: number, broadcast = true) => {
            setIsDarkMode(enabled);
            setBrightness(nextBrightness);
            if (broadcast) {
                broadcastSceneEvent('night_mode', {
                    enabled,
                    brightness: nextBrightness,
                });
            }
        },
        [broadcastSceneEvent]
    );

    const createRippleEffect = useCallback((x: number, y: number, broadcast = true) => {
        setRipplePosition({ x, y });
        setShowRipple(true);

        setTimeout(() => {
            setShowRipple(false);
        }, 3000);

        if (broadcast) {
            broadcastSceneEvent('ripple_effect', { x, y });
        }
    }, [broadcastSceneEvent]);

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
                    createRippleEffect(data.x ?? 0, data.y ?? 0, false);
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
                } else if (data.eventType === 'night_mode') {
                    const enabled = Boolean(data.enabled);
                    const nextBrightness =
                        typeof data.brightness === 'number' ? data.brightness : brightness;
                    applyNightMode(enabled, nextBrightness, false);
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
        applyNightMode,
        brightness,
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
        const handleDocumentClick = (e: MouseEvent) => {
            if (activeTool !== 'marker') return;

            if (justActivatedMarker) {
                setJustActivatedMarker(false);
                return;
            }

            const target = e.target as HTMLElement;
            if (!isClickOnUiElement(target)) {
                createRippleEffect(e.clientX, e.clientY);
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
    }, [activeTool, justActivatedMarker, createRippleEffect]);

    useEffect(() => {
        const handleDocumentClick = (e: MouseEvent) => {
            if (activeTool !== 'measure') return;

            if (justActivatedMeasure) {
                setJustActivatedMeasure(false);
                return;
            }

            const target = e.target as HTMLElement;
            if (!isClickOnUiElement(target)) {
                const nextPoint = { x: e.clientX, y: e.clientY };
                setMeasurePoints((prev) => {
                    const next = [...prev, nextPoint];
                    broadcastSceneEvent('measure_update', { points: next });
                    return next;
                });
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
    }, [activeTool, justActivatedMeasure, broadcastSceneEvent]);

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

    const activateMeasureTool = () => {
        if (activeTool === 'measure') {
            setActiveTool('pointer');
            return;
        }
        setActiveTool('measure');
        setJustActivatedMeasure(true);
    };

    const showMeasureOverlay =
        activeTool === 'measure' || measurePoints.length > 0;

    return (
        <>
            <div ref={menuRef} className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1002]">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="glass-panel flex items-center gap-2 px-4 py-2"
                        >
                            <Menu className="h-4 w-4" />
                            <span className="text-xs font-medium">Gameboard</span>

                            {connectionStatus === 'connected' ? (
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
                            ) : (
                                <div className="ml-1 h-2 w-2 rounded-full bg-muted-foreground" />
                            )}
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="center" className="glass-panel w-56 border-border/50">
                        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Tools</DropdownMenuLabel>

                        <DropdownMenuItem
                            className={cn("text-xs cursor-pointer", activeTool === 'pointer' && "bg-accent")}
                            onClick={() => setActiveTool('pointer')}
                        >
                            <MousePointer className="h-4 w-4 mr-2" />
                            Pointer
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            className={cn("text-xs cursor-pointer", activeTool === 'marker' && "bg-accent")}
                            onClick={() => {
                                setActiveTool('marker');
                                setJustActivatedMarker(true);
                            }}
                        >
                            <Target className="h-4 w-4 mr-2" />
                            Marker (Ripple Effect)
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            className={cn("text-xs cursor-pointer", activeTool === 'measure' && "bg-accent")}
                            onClick={activateMeasureTool}
                        >
                            <Ruler className="h-4 w-4 mr-2" />
                            Measure (ft)
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Visual Effects</DropdownMenuLabel>

                        <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={() => toggleLightningEffect()}
                        >
                            <CloudLightning className="h-4 w-4 mr-2" />
                            Lightning Flash
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={() => toggleShakeEffect()}
                        >
                            <ZapIcon className="h-4 w-4 mr-2" />
                            Shake Board
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            className={cn("text-xs cursor-pointer", isDarkMode && "bg-accent")}
                            onClick={toggleDayNight}
                        >
                            {isDarkMode ? (
                                <>
                                    <SunIcon className="h-4 w-4 mr-2" />
                                    Day Mode
                                </>
                            ) : (
                                <>
                                    <MoonIcon className="h-4 w-4 mr-2" />
                                    Night Mode
                                </>
                            )}
                        </DropdownMenuItem>

                        {isDarkMode && (
                            <div className="px-2 py-2">
                                <div className="mb-1 text-xs text-muted-foreground">Brightness: {brightness}%</div>
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    value={brightness}
                                    onChange={(e) =>
                                        handleBrightnessChange(parseInt(e.target.value, 10))
                                    }
                                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary"
                                />
                            </div>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Status</DropdownMenuLabel>
                        <DropdownMenuItem className="text-xs cursor-default">
                            <Wifi className="h-4 w-4 mr-2" />
                            {connectionStatus === 'connected' ? (
                                <span className="text-emerald-500">Connected</span>
                            ) : (
                                <span className="capitalize text-muted-foreground">{connectionStatus}</span>
                            )}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
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

            {showMeasureOverlay && (
                <MeasureOverlay
                    points={measurePoints}
                    totalFeet={totalMeasureFeet}
                    showEmptyHint={activeTool === 'measure'}
                />
            )}

            {isDarkMode && (
                <div
                    className="fixed inset-0 bg-black pointer-events-none z-[900] transition-opacity duration-500"
                    style={{ opacity: 1 - (brightness / 100) }}
                />
            )}

            {showRipple && (
                <div className="fixed pointer-events-none z-[900]" style={{ left: ripplePosition.x, top: ripplePosition.y }}>
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
        </>
    );
};
