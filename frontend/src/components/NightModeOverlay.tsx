import React from 'react';

interface NightModeOverlayProps {
    enabled: boolean;
    brightness: number;
    zIndex: number;
}

export const NightModeOverlay: React.FC<NightModeOverlayProps> = ({
    enabled,
    brightness,
    zIndex,
}) => {
    if (!enabled) {
        return null;
    }

    return (
        <div
            className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-500"
            style={{ opacity: 1 - brightness / 100, zIndex }}
        />
    );
};
