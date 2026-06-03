import React from 'react';
import { cn } from '@/lib/utils';
import type { MeasurePoint } from '@/utils/measureDistance';
import { formatMeasureFeet } from '@/utils/measureDistance';

interface MeasureOverlayProps {
    points: MeasurePoint[];
    totalFeet: number;
    className?: string;
    showEmptyHint?: boolean;
}

export const MeasureOverlay: React.FC<MeasureOverlayProps> = ({
    points,
    totalFeet,
    className,
    showEmptyHint = false,
}) => {
    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
    const last = points[points.length - 1];
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
                'fixed inset-0 pointer-events-none z-[900]',
                className
            )}
        >
            <svg className="h-full w-full">
                {points.length >= 2 && (
                    <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke="#4ade80"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {points.map((p, i) => (
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
