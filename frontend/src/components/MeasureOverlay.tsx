import React, { useEffect, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { getPlayAreaRect } from '@/utils/aoeCoordinates';
import type { MeasurePoint } from '@/utils/measureDistance';
import {
    formatMeasureFeet,
    measurePointToContainerPixels,
} from '@/utils/measureDistance';

interface MeasureOverlayProps {
    points: MeasurePoint[];
    totalFeet: number;
    containerRef: RefObject<HTMLElement | null>;
    className?: string;
    showEmptyHint?: boolean;
}

export const MeasureOverlay: React.FC<MeasureOverlayProps> = ({
    points,
    totalFeet,
    containerRef,
    className,
    showEmptyHint = false,
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

    const polylinePoints = displayPoints.map((p) => `${p.x},${p.y}`).join(' ');
    const last = displayPoints[displayPoints.length - 1];
    const labelText =
        points.length >= 2
            ? formatMeasureFeet(totalFeet)
            : showEmptyHint
              ? 'Click to measure'
              : formatMeasureFeet(0);

    const labelLeft = last ? last.x + 12 : 12;
    const labelTop = last ? last.y - 28 : 12;

    return (
        <div
            className={cn(
                'absolute inset-0 pointer-events-none z-[900]',
                className
            )}
        >
            <svg className="h-full w-full">
                {displayPoints.length >= 2 && (
                    <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke="#4ade80"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {displayPoints.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={5}
                        fill="#4ade80"
                        stroke="#166534"
                        strokeWidth={1.5}
                    />
                ))}
            </svg>
            <div
                className="absolute rounded bg-black/60 px-2 py-1 text-xs font-medium text-white"
                style={{ left: labelLeft, top: labelTop }}
            >
                {labelText}
            </div>
        </div>
    );
};
