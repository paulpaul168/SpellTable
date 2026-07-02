import React, { useEffect, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { getPlayAreaRect } from '@/utils/aoeCoordinates';
import type { MeasurePoint } from '@/utils/measureDistance';
import {
    formatMeasureFeet,
    measurePointToContainerPixels,
} from '@/utils/measureDistance';

interface TokenMovementTrailProps {
    points: MeasurePoint[];
    previewPoint?: MeasurePoint | null;
    totalFeet: number;
    containerRef: RefObject<HTMLElement | null>;
    /** Token radius in pixels — positions label above the token center. */
    tokenRadius?: number;
    className?: string;
}

export const TokenMovementTrail: React.FC<TokenMovementTrailProps> = ({
    points,
    previewPoint,
    totalFeet,
    containerRef,
    tokenRadius = 28,
    className,
}) => {
    const [, setResizeTick] = useState(0);

    useEffect(() => {
        const handleResize = () => setResizeTick((n) => n + 1);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const containerRect = getPlayAreaRect(containerRef.current);
    const displayPoints = points.map((p) =>
        measurePointToContainerPixels(p, containerRect)
    );
    const previewDisplay = previewPoint
        ? measurePointToContainerPixels(previewPoint, containerRect)
        : null;

    const hasPreview =
        previewDisplay !== null &&
        (displayPoints.length === 0 ||
            Math.hypot(
                previewDisplay.x - displayPoints[displayPoints.length - 1].x,
                previewDisplay.y - displayPoints[displayPoints.length - 1].y
            ) > 1);

    if (displayPoints.length < 2 && !hasPreview) {
        return null;
    }

    const polylinePoints = displayPoints.map((p) => `${p.x},${p.y}`).join(' ');
    const labelAnchor = hasPreview
        ? previewDisplay!
        : displayPoints[displayPoints.length - 1];
    const labelGap = 8;

    return (
        <div
            className={cn(
                'absolute inset-0 pointer-events-none',
                className
            )}
        >
            <svg className="h-full w-full">
                {displayPoints.length >= 2 && (
                    <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {hasPreview && displayPoints.length >= 1 && (
                    <line
                        x1={displayPoints[displayPoints.length - 1].x}
                        y1={displayPoints[displayPoints.length - 1].y}
                        x2={previewDisplay!.x}
                        y2={previewDisplay!.y}
                        stroke="#fbbf24"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        strokeLinecap="round"
                        opacity={0.7}
                    />
                )}
                {displayPoints.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill="#fbbf24"
                        stroke="#b45309"
                        strokeWidth={1.5}
                    />
                ))}
            </svg>
            <div
                className="absolute rounded bg-black/60 px-2 py-1 text-xs font-medium text-amber-200 whitespace-nowrap"
                style={{
                    left: labelAnchor.x,
                    top: labelAnchor.y - tokenRadius - labelGap,
                    transform: 'translate(-50%, -100%)',
                }}
            >
                {formatMeasureFeet(totalFeet)} moved
            </div>
        </div>
    );
};
