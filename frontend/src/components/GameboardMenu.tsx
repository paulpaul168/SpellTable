import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    MousePointer,
    ZapIcon,
    SunIcon,
    MoonIcon,
    Ruler,
    Grid,
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

interface GameboardMenuProps {
    connectionStatus: string;
}

export const GameboardMenu: React.FC<GameboardMenuProps> = ({ connectionStatus }) => {
    // State for active tool and options
    const [activeTool, setActiveTool] = useState<string>('pointer');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [brightness, setBrightness] = useState(100);
    const [showRipple, setShowRipple] = useState(false);
    const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
    const [showMeasuringGrid, setShowMeasuringGrid] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const [justActivatedMarker, setJustActivatedMarker] = useState(false);

    // References
    const gameboardRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

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

    const applyMeasuringGrid = useCallback(
        (enabled: boolean, broadcast = true) => {
            setShowMeasuringGrid(enabled);
            if (broadcast) {
                broadcastSceneEvent('measuring_grid', { enabled });
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

    // Listen for remote ripple effects from admin
    useEffect(() => {
        const handleRemoteEvents = (data: any) => {
            if (data.type === 'scene_update' && data.scene) {
                //console.log('scene update', data);
                // Handle scene updates if needed
            } else if (data.type === 'scene_event') {
                if (data.eventType === 'ripple_effect') {
                    createRippleEffect(data.x, data.y, false); // Add false parameter to avoid re-broadcasting
                } else if (data.eventType === 'lightning_effect') {
                    toggleLightningEffect(false);
                } else if (data.eventType === 'shake_effect') {
                    toggleShakeEffect(false);
                } else if (data.eventType === 'measuring_grid') {
                    applyMeasuringGrid(Boolean(data.enabled), false);
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
        applyMeasuringGrid,
        applyNightMode,
        brightness,
    ]);

    // Apply shake effect to body
    useEffect(() => {
        if (isShaking && typeof document !== 'undefined') {
            document.body.classList.add('shake-effect');

            // Remove class after animation completes
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

    // Add event listener for document clicks when marker tool is active
    useEffect(() => {
        const handleDocumentClick = (e: MouseEvent) => {
            if (activeTool !== 'marker') return;

            // If we just activated marker mode, ignore the first click
            if (justActivatedMarker) {
                setJustActivatedMarker(false);
                return;
            }

            // Check if we're clicking on a UI element
            const target = e.target as HTMLElement;
            const isUIElement =
                target.closest('button') ||
                target.closest('[role="button"]') ||
                target.closest('.dropdown') ||
                target.closest('input') ||
                target.closest('select') ||
                target.closest('a') ||
                target.closest('menu') ||
                target.closest('label') ||
                target.closest('[data-ui-element="true"]');

            // If not a UI element, create a ripple
            if (!isUIElement) {
                createRippleEffect(e.clientX, e.clientY);
            }
        };

        // Add/remove event listener
        if (activeTool === 'marker') {
            document.addEventListener('click', handleDocumentClick);
            document.body.style.cursor = 'crosshair';
        }

        return () => {
            document.removeEventListener('click', handleDocumentClick);
            document.body.style.cursor = '';
        };
    }, [activeTool, justActivatedMarker, createRippleEffect]);

    const handlePointerClick = (e: React.MouseEvent) => {
        // Function no longer needed, we use document-level click handler instead
    };

    const toggleDayNight = () => {
        const nextEnabled = !isDarkMode;
        applyNightMode(nextEnabled, brightness);
    };

    const toggleMeasuringGrid = () => {
        applyMeasuringGrid(!showMeasuringGrid);
    };

    const handleBrightnessChange = (value: number) => {
        applyNightMode(true, value);
    };

    // Check if a click is inside the menu area to prevent overlay from capturing those clicks
    const isInsideMenu = (e: React.MouseEvent) => {
        if (!menuRef.current) return false;

        // Check if target or its parents have z-index higher than our overlay
        let el = e.target as HTMLElement;
        while (el) {
            const zIndex = window.getComputedStyle(el).zIndex;
            const isButton = el.tagName === 'BUTTON' ||
                el.className.includes('dropdown') ||
                el.role === 'button' ||
                el.className.includes('button');

            if (zIndex && parseInt(zIndex) > 500 || isButton) {
                return true;
            }
            el = el.parentElement as HTMLElement;
            if (!el) break;
        }

        // Also check the menu specifically
        const rect = menuRef.current.getBoundingClientRect();
        return (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        );
    };

    // Add exit ripple mode function
    const exitRippleMode = () => {
        setActiveTool('pointer');
    };

    return (
        <>
            {/* Main Menu Button */}
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

                            {/* Connection Status Indicator (small on the side) */}
                            {connectionStatus === 'connected' ? (
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
                            ) : (
                                <div className="ml-1 h-2 w-2 rounded-full bg-muted-foreground" />
                            )}
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="center" className="glass-panel w-56 border-border/50">
                        {/* Tools Section */}
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
                            className={cn("text-xs cursor-pointer", showMeasuringGrid && "bg-accent")}
                            onClick={toggleMeasuringGrid}
                        >
                            <Ruler className="h-4 w-4 mr-2" />
                            Measuring Grid (5ft)
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Visual Effects Section */}
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

                        {/* Brightness Slider (only show in night mode) */}
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

                        {/* Connection Status */}
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

            {/* Tool Status Indicator */}
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

            {/* Overlay Elements */}
            {/* Measuring Grid */}
            {showMeasuringGrid && (
                <div
                    className="fixed inset-0 pointer-events-none z-[900]"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px)
                        `,
                        backgroundSize: '50px 50px',
                    }}
                >
                    {/* Grid Labels */}
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        5ft per square
                    </div>
                </div>
            )}

            {/* Night Mode Overlay */}
            {isDarkMode && (
                <div
                    className="fixed inset-0 bg-black pointer-events-none z-[900] transition-opacity duration-500"
                    style={{ opacity: 1 - (brightness / 100) }}
                />
            )}

            {/* Ripple Effect */}
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