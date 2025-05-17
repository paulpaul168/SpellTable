import React, { useState, useRef, useEffect } from 'react';
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

// Add keyframe animations to the global stylesheet
// This avoids using styled-jsx which might be causing import issues
if (typeof document !== 'undefined') {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        @keyframes ripple {
            0% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 0.8;
            }
            100% {
                transform: translate(-50%, -50%) scale(1.5);
                opacity: 0;
            }
        }
        .animate-ripple-1 {
            animation: ripple 1.5s ease-out infinite;
        }
        .animate-ripple-2 {
            animation: ripple 1.5s ease-out 0.2s infinite;
        }
        .animate-ripple-3 {
            animation: ripple 1.5s ease-out 0.4s infinite;
        }
        
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .shake-effect {
            animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
    `;
    document.head.appendChild(styleElement);
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

    // Listen for remote ripple effects from admin
    useEffect(() => {
        const handleRemoteEvents = (data: any) => {
            if (data.type === 'ripple_effect') {
                createRippleEffect(data.x, data.y);
            } else if (data.type === 'lightning_effect') {
                toggleLightningEffect();
            } else if (data.type === 'shake_effect') {
                toggleShakeEffect();
            }
        };

        const unsubscribe = websocketService.addListener(handleRemoteEvents);

        return () => {
            unsubscribe();
        };
    }, []);

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

                // Broadcast the ripple effect to all viewers
                websocketService.send({
                    type: 'ripple_effect',
                    x: e.clientX,
                    y: e.clientY
                });
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
    }, [activeTool, justActivatedMarker]);

    // Methods for various effects
    const createRippleEffect = (x: number, y: number) => {
        setRipplePosition({ x, y });
        setShowRipple(true);

        // Remove ripple effect after animation completes
        setTimeout(() => {
            setShowRipple(false);
        }, 1500);
    };

    const handlePointerClick = (e: React.MouseEvent) => {
        // Function no longer needed, we use document-level click handler instead
    };

    const toggleLightningEffect = () => {
        // Flash the screen briefly with lightning effect
        if (typeof document !== 'undefined') {
            const lightning = document.createElement('div');
            lightning.className = 'fixed inset-0 bg-white/30 z-[900] pointer-events-none';
            document.body.appendChild(lightning);

            // Flash sequence
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

            // Broadcast the lightning effect to viewers
            websocketService.send({
                type: 'lightning_effect'
            });
        }
    };

    const toggleShakeEffect = () => {
        setIsShaking(true);

        // Broadcast the shake effect to viewers
        websocketService.send({
            type: 'shake_effect'
        });
    };

    const toggleDayNight = () => {
        setIsDarkMode(!isDarkMode);
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
                            className="px-4 py-2 rounded-md bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 flex items-center gap-2"
                        >
                            <Menu className="h-4 w-4" />
                            <span className="text-xs font-medium">Gameboard</span>

                            {/* Connection Status Indicator (small on the side) */}
                            {connectionStatus === 'connected' ? (
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
                            ) : (
                                <div className="h-2 w-2 rounded-full bg-zinc-600 ml-1" />
                            )}
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="center" className="w-56 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800">
                        {/* Tools Section */}
                        <DropdownMenuLabel className="text-xs font-medium text-zinc-400">Tools</DropdownMenuLabel>

                        <DropdownMenuItem
                            className={cn("text-xs cursor-pointer", activeTool === 'pointer' && "bg-zinc-800")}
                            onClick={() => setActiveTool('pointer')}
                        >
                            <MousePointer className="h-4 w-4 mr-2" />
                            Pointer
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            className={cn("text-xs cursor-pointer", activeTool === 'marker' && "bg-zinc-800")}
                            onClick={() => {
                                setActiveTool('marker');
                                setJustActivatedMarker(true);
                            }}
                        >
                            <Target className="h-4 w-4 mr-2" />
                            Marker (Ripple Effect)
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            className={cn("text-xs cursor-pointer", showMeasuringGrid && "bg-zinc-800")}
                            onClick={() => setShowMeasuringGrid(!showMeasuringGrid)}
                        >
                            <Ruler className="h-4 w-4 mr-2" />
                            Measuring Grid (5ft)
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="bg-zinc-800" />

                        {/* Visual Effects Section */}
                        <DropdownMenuLabel className="text-xs font-medium text-zinc-400">Visual Effects</DropdownMenuLabel>

                        <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={toggleLightningEffect}
                        >
                            <CloudLightning className="h-4 w-4 mr-2" />
                            Lightning Flash
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={toggleShakeEffect}
                        >
                            <ZapIcon className="h-4 w-4 mr-2" />
                            Shake Board
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            className={cn("text-xs cursor-pointer", isDarkMode && "bg-zinc-800")}
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
                                <div className="text-xs text-zinc-400 mb-1">Brightness: {brightness}%</div>
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    value={brightness}
                                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        )}

                        <DropdownMenuSeparator className="bg-zinc-800" />

                        {/* Connection Status */}
                        <DropdownMenuLabel className="text-xs font-medium text-zinc-400">Status</DropdownMenuLabel>
                        <DropdownMenuItem className="text-xs cursor-default">
                            <Wifi className="h-4 w-4 mr-2" />
                            {connectionStatus === 'connected' ? (
                                <span className="text-emerald-500">Connected</span>
                            ) : (
                                <span className="text-zinc-600 capitalize">{connectionStatus}</span>
                            )}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Tool Status Indicator */}
            {activeTool === 'marker' && (
                <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[1002] bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 px-4 py-2 rounded-md">
                    <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs text-zinc-300">Click anywhere to create a ripple marker</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={exitRippleMode}
                        >
                            <X className="h-3 w-3 text-zinc-400" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Exit Ripple Mode Button - Visible when in ripple mode */}
            {activeTool === 'marker' && (
                <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-[1002]">
                    <Button
                        variant="outline"
                        size="sm"
                        className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 px-3 py-1"
                        onClick={exitRippleMode}
                    >
                        <MousePointer className="h-3 w-3 mr-2" />
                        <span className="text-xs">Exit Marker Mode</span>
                    </Button>
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
                            width: '60px',
                            height: '60px',
                            border: '2px solid #4ade80',
                            transform: 'translate(-50%, -50%)',
                            opacity: 0.8,
                        }}
                    />
                    <div
                        className="absolute rounded-full animate-ripple-2"
                        style={{
                            width: '80px',
                            height: '80px',
                            border: '2px solid #4ade80',
                            transform: 'translate(-50%, -50%)',
                            opacity: 0.6,
                            animationDelay: '0.2s',
                        }}
                    />
                    <div
                        className="absolute rounded-full animate-ripple-3"
                        style={{
                            width: '100px',
                            height: '100px',
                            border: '2px solid #4ade80',
                            transform: 'translate(-50%, -50%)',
                            opacity: 0.4,
                            animationDelay: '0.4s',
                        }}
                    />
                </div>
            )}
        </>
    );
}; 