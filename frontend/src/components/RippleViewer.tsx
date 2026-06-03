import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { websocketService } from '../services/websocket';
import type { Scene } from '@/types/map';
import { MeasureOverlay } from './MeasureOverlay';
import {
    getGridCellDimensions,
    pathLengthFeet,
    type MeasurePoint,
} from '@/utils/measureDistance';

// Add keyframe animations to the global stylesheet
if (typeof document !== 'undefined') {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        @keyframes ripple {
            0% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 0.9;
            }
            50% {
                opacity: 0.5;
            }
            100% {
                transform: translate(-50%, -50%) scale(2);
                opacity: 0;
            }
        }
        .animate-ripple-1 {
            animation: ripple 3s ease-out infinite;
        }
        .animate-ripple-2 {
            animation: ripple 3s ease-out 0.5s infinite;
        }
        .animate-ripple-3 {
            animation: ripple 3s ease-out 1s infinite;
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

interface RippleViewerProps {
    hidden?: boolean;
    gridSettings: Scene['gridSettings'];
}

export const RippleViewer: React.FC<RippleViewerProps> = ({
    hidden = false,
    gridSettings,
}) => {
    const [showRipple, setShowRipple] = useState(false);
    const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
    const [isShaking, setIsShaking] = useState(false);
    const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);

    const cellDims = useMemo(
        () => getGridCellDimensions(gridSettings),
        [gridSettings]
    );

    const totalMeasureFeet = useMemo(
        () => pathLengthFeet(measurePoints, cellDims),
        [measurePoints, cellDims]
    );

    const createRippleEffect = useCallback((x: number, y: number) => {
        setRipplePosition({ x, y });
        setShowRipple(true);

        setTimeout(() => {
            setShowRipple(false);
        }, 3000);
    }, []);

    const createLightningEffect = useCallback(() => {
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
        }
    }, []);

    const createShakeEffect = useCallback(() => {
        setIsShaking(true);
    }, []);

    useEffect(() => {
        const handleRemoteEvents = (data: {
            type?: string;
            eventType?: string;
            x?: number;
            y?: number;
            enabled?: boolean;
            brightness?: number;
            points?: MeasurePoint[];
            event?: { type?: string; x?: number; y?: number };
        }) => {
            if (data.type === 'scene_update' && data.event) {
                if (data.event.type === 'ripple_effect') {
                    createRippleEffect(data.event.x ?? 0, data.event.y ?? 0);
                } else if (data.event.type === 'lightning_effect') {
                    createLightningEffect();
                } else if (data.event.type === 'shake_effect') {
                    createShakeEffect();
                }
            } else if (data.type === 'scene_event') {
                if (data.eventType === 'ripple_effect') {
                    createRippleEffect(data.x ?? 0, data.y ?? 0);
                } else if (data.eventType === 'lightning_effect') {
                    createLightningEffect();
                } else if (data.eventType === 'shake_effect') {
                    createShakeEffect();
                } else if (data.eventType === 'measure_update') {
                    if (Array.isArray(data.points)) {
                        setMeasurePoints(data.points);
                    }
                } else if (data.eventType === 'measure_clear') {
                    setMeasurePoints([]);
                }
            }
        };

        const unsubscribe = websocketService.addListener(handleRemoteEvents);

        return () => {
            unsubscribe();
        };
    }, [
        createRippleEffect,
        createLightningEffect,
        createShakeEffect,
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

    if (hidden) {
        return null;
    }

    return (
        <>
            {measurePoints.length > 0 && (
                <MeasureOverlay
                    points={measurePoints}
                    totalFeet={totalMeasureFeet}
                />
            )}

            {showRipple && (
                <div
                    className="fixed pointer-events-none z-[900]"
                    style={{ left: ripplePosition.x, top: ripplePosition.y }}
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
        </>
    );
};
