import React, { useState } from 'react';
import { AoEShape, AoEMarker } from '../types/map';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Circle,
    PlusCircle,
    Triangle,
    Minus,
    Square,
    Box,
    Cylinder as CylinderIcon,
    X,
    Trash2,
    EyeIcon,
    Settings,
} from 'lucide-react';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { AoEEffectTheme } from '@/types/aoeEffect';
import { AOE_EFFECT_THEMES, DEFAULT_AOE_EFFECT_THEME } from '@/types/aoeEffect';

const AOE_THEME_LABELS: Record<AoEEffectTheme, string> = {
    pixel: 'Pixel',
    realistic: 'Hyper-realistic',
    none: 'No animations',
};

interface AoEPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onAddMarker: (marker: Omit<AoEMarker, 'id' | 'position'>) => void;
    aoeStagedReveal?: boolean;
    onStagedRevealChange?: (enabled: boolean) => void;
    aoeEffectTheme?: AoEEffectTheme;
    onAoeEffectThemeChange?: (theme: AoEEffectTheme) => void;
    activeMarkers?: AoEMarker[];
    onDeleteMarker?: (id: string) => void;
    onHighlightMarker?: (id: string) => void;
}

// Common D&D spell AoEs with their typical sizes
const commonAoEs = [
    { name: 'Small Circle (10\')', shape: 'circle', size: 10, color: '#FF5A5A' },
    { name: 'Medium Circle (20\')', shape: 'circle', size: 20, color: '#FF5A5A' },
    { name: 'Large Circle (30\')', shape: 'circle', size: 30, color: '#FF5A5A' },
    { name: 'Cone (15\')', shape: 'cone', size: 15, color: '#FFCC5A' },
    { name: 'Cone (30\')', shape: 'cone', size: 30, color: '#FFCC5A' },
    { name: 'Line (30\')', shape: 'line', size: 30, color: '#5AD5FF' },
    { name: 'Line (60\')', shape: 'line', size: 60, color: '#5AD5FF' },
    { name: 'Square (10\')', shape: 'square', size: 10, color: '#75FF5A' },
    { name: 'Square (20\')', shape: 'square', size: 20, color: '#75FF5A' },
    { name: 'Cube (15\')', shape: 'cube', size: 15, color: '#5A7FFF' },
    { name: 'Cylinder (10\')', shape: 'cylinder', size: 10, color: '#CC5AFF' },
    { name: 'Cylinder (20\')', shape: 'cylinder', size: 20, color: '#CC5AFF' },
];

type SpellPreset = {
    name: string;
    shape: AoEShape;
    size: number;
    color: string;
    effectId?: string;
};

// Common D&D spells with AoE (20′ radius → 40′ diameter for sizeInFeet)
const commonSpells: SpellPreset[] = [
    { name: 'Fireball', shape: 'circle', size: 40, color: '#FF5A5A', effectId: 'fireball' },
    { name: 'Burning Hands', shape: 'cone', size: 15, color: '#FF5A5A', effectId: 'burning-hands' },
    { name: 'Lightning Bolt', shape: 'line', size: 100, color: '#5AD5FF', effectId: 'lightning-bolt' },
    { name: 'Call Lightning', shape: 'circle', size: 40, color: '#5AD5FF', effectId: 'call-lightning' },
    { name: 'Cone of Cold', shape: 'cone', size: 60, color: '#5AD5FF', effectId: 'cone-of-cold' },
    { name: 'Wall of Fire', shape: 'line', size: 60, color: '#FF5A5A', effectId: 'wall-of-fire' },
    { name: 'Cloudkill', shape: 'circle', size: 20, color: '#C9E265', effectId: 'cloudkill' },
    { name: 'Spirit Guardians', shape: 'circle', size: 15, color: '#CC5AFF', effectId: 'spirit-guardians' },
    {
        name: 'Spirit Guardians (Necrotic)',
        shape: 'circle',
        size: 15,
        color: '#3D5C2E',
        effectId: 'spirit-guardians-necrotic',
    },
    {
        name: 'Spirit Guardians (Radiant)',
        shape: 'circle',
        size: 15,
        color: '#FFE566',
        effectId: 'spirit-guardians-radiant',
    },
    { name: 'Meteor Swarm', shape: 'circle', size: 40, color: '#FF5A5A', effectId: 'meteor-swarm' },
    { name: 'Web', shape: 'cube', size: 20, color: '#FFFFFF' },
    { name: 'Darkness', shape: 'circle', size: 15, color: '#000000', effectId: 'darkness' },
    { name: 'Fog Cloud', shape: 'circle', size: 20, color: '#C9C9C9', effectId: 'fog-cloud' },
];

export const AoEPalette: React.FC<AoEPaletteProps> = ({
    isOpen,
    onClose,
    onAddMarker,
    aoeStagedReveal = false,
    onStagedRevealChange,
    aoeEffectTheme = DEFAULT_AOE_EFFECT_THEME,
    onAoeEffectThemeChange,
    activeMarkers = [],
    onDeleteMarker,
    onHighlightMarker,
}) => {
    const [activeTab, setActiveTab] = useState<'shapes' | 'spells' | 'custom' | 'markers'>('shapes');
    const [showSettings, setShowSettings] = useState(false);
    const [customShape, setCustomShape] = useState<AoEShape>('circle');
    const [customSize, setCustomSize] = useState(20);
    const [customColor, setCustomColor] = useState('#FF5A5A');
    const [customLabel, setCustomLabel] = useState('');
    const [opacity, setOpacity] = useState(0.5);

    // Function to handle adding from presets
    const handleAddFromPreset = (
        shape: AoEShape,
        size: number,
        color: string,
        label?: string,
        effectId?: string,
    ) => {
        onAddMarker({
            shape,
            sizeInFeet: size,
            color,
            rotation: 0,
            opacity,
            label,
            effectId,
        });
    };

    // Function to handle adding custom shape
    const handleAddCustom = () => {
        onAddMarker({
            shape: customShape,
            sizeInFeet: customSize,
            color: customColor,
            rotation: 0,
            opacity,
            label: customLabel || undefined
        });
    };

    // Helper function to render shape preview
    const renderShapePreview = (shape: AoEShape, color: string, size: number = 16) => {
        switch (shape) {
            case 'circle':
                return <div className="rounded-full" style={{ width: size, height: size, backgroundColor: color }} />;
            case 'cone':
                return (
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
                        <polygon
                            points={`${size / 2},0 0,${size} ${size},${size}`}
                            fill={color}
                        />
                    </svg>
                );
            case 'line':
                return (
                    <div
                        style={{
                            width: size,
                            height: Math.max(3, Math.round(size / 4)),
                            backgroundColor: color,
                        }}
                    />
                );
            case 'square':
            case 'cube':
                return <Square className="h-4 w-4" style={{ color }} />;
            case 'cylinder':
                return <CylinderIcon className="h-4 w-4" style={{ color }} />;
            default:
                return <Circle className="h-4 w-4" style={{ color }} />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="glass-panel fixed bottom-20 left-1/2 z-[1001] w-72 -translate-x-1/2 rounded-lg transition-all duration-200">
            {/* Header */}
            <div className="glass-panel-header flex items-center justify-between py-2">
                <h3 className="text-sm font-medium text-foreground">AoE Markers</h3>
                <div className="flex gap-1 ml-auto">
                    {(onStagedRevealChange || onAoeEffectThemeChange) && (
                        <Button
                            variant={showSettings ? 'default' : 'ghost'}
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setShowSettings((prev) => !prev)}
                            title="Settings"
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div>
                {/* Tabs */}
                {!showSettings && (
                <div className="flex items-center border-b border-border/50 p-2">
                    <Button
                        variant={activeTab === 'shapes' ? 'default' : 'ghost'}
                        size="sm"
                        className="text-xs flex-1"
                        onClick={() => setActiveTab('shapes')}
                    >
                        Shapes
                    </Button>
                    <Button
                        variant={activeTab === 'spells' ? 'default' : 'ghost'}
                        size="sm"
                        className="text-xs flex-1"
                        onClick={() => setActiveTab('spells')}
                    >
                        Spells
                    </Button>
                    <Button
                        variant={activeTab === 'custom' ? 'default' : 'ghost'}
                        size="sm"
                        className="text-xs flex-1"
                        onClick={() => setActiveTab('custom')}
                    >
                        Custom
                    </Button>
                    <Button
                        variant={activeTab === 'markers' ? 'default' : 'ghost'}
                        size="sm"
                        className="text-xs flex-1"
                        onClick={() => setActiveTab('markers')}
                    >
                        Markers
                    </Button>
                </div>
                )}

                {/* Opacity control - common to shape tabs only */}
                {!showSettings && activeTab !== 'markers' && (
                    <div className="px-3 pt-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Opacity: {Math.round(opacity * 100)}%</Label>
                        </div>
                        <Slider
                            value={[opacity * 100]}
                            min={10}
                            max={90}
                            step={5}
                            onValueChange={(values) => setOpacity(values[0] / 100)}
                            className="mt-1.5"
                        />
                    </div>
                )}

                {/* Shapes Tab */}
                {!showSettings && activeTab === 'shapes' && (
                    <div className="max-h-80 overflow-y-auto p-2">
                        <div className="grid grid-cols-2 gap-2">
                            {commonAoEs.map((aoe, index) => (
                                <Button
                                    key={index}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs justify-start"
                                    onClick={() => handleAddFromPreset(aoe.shape as AoEShape, aoe.size, aoe.color)}
                                >
                                    <span className="mr-2 flex w-4 shrink-0 items-center justify-center">
                                        {renderShapePreview(aoe.shape as AoEShape, aoe.color, 12)}
                                    </span>
                                    {aoe.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Spells Tab */}
                {!showSettings && activeTab === 'spells' && (
                    <div className="max-h-80 overflow-y-auto p-2">
                        <div className="grid grid-cols-1 gap-2">
                            {commonSpells.map((spell, index) => (
                                <Button
                                    key={index}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs justify-start"
                                    onClick={() => handleAddFromPreset(
                                        spell.shape,
                                        spell.size,
                                        spell.color,
                                        spell.name,
                                        spell.effectId,
                                    )}
                                >
                                    <span className="mr-2 flex w-4 shrink-0 items-center justify-center">
                                        {renderShapePreview(spell.shape, spell.color, 12)}
                                    </span>
                                    {spell.name} ({spell.size}&apos;)
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Custom Tab */}
                {!showSettings && activeTab === 'custom' && (
                    <div className="p-2 space-y-3">
                        <div>
                            <Label className="text-xs text-zinc-400">Shape</Label>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                                <Button
                                    variant={customShape === 'circle' ? 'default' : 'outline'}
                                    size="sm"
                                    className="p-1"
                                    onClick={() => setCustomShape('circle')}
                                >
                                    <Circle className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={customShape === 'cone' ? 'default' : 'outline'}
                                    size="sm"
                                    className="p-1"
                                    onClick={() => setCustomShape('cone')}
                                >
                                    <Triangle className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={customShape === 'line' ? 'default' : 'outline'}
                                    size="sm"
                                    className="p-1"
                                    onClick={() => setCustomShape('line')}
                                >
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={customShape === 'square' ? 'default' : 'outline'}
                                    size="sm"
                                    className="p-1"
                                    onClick={() => setCustomShape('square')}
                                >
                                    <Square className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={customShape === 'cube' ? 'default' : 'outline'}
                                    size="sm"
                                    className="p-1"
                                    onClick={() => setCustomShape('cube')}
                                >
                                    <Box className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={customShape === 'cylinder' ? 'default' : 'outline'}
                                    size="sm"
                                    className="p-1"
                                    onClick={() => setCustomShape('cylinder')}
                                >
                                    <CylinderIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs text-zinc-400">Size (feet)</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input
                                    type="number"
                                    value={customSize}
                                    onChange={(e) => setCustomSize(Number(e.target.value))}
                                    className="text-xs"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => setCustomSize(5)}
                                >
                                    5&apos;
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => setCustomSize(15)}
                                >
                                    15&apos;
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => setCustomSize(30)}
                                >
                                    30&apos;
                                </Button>
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs text-zinc-400">Color</Label>
                            <div className="flex items-center justify-between gap-2 mt-1">
                                <Input
                                    type="color"
                                    value={customColor}
                                    onChange={(e) => setCustomColor(e.target.value)}
                                    className="w-12 h-8 p-1"
                                />

                                <div className="grid grid-cols-6 gap-1 flex-1">
                                    {[
                                        '#FF5A5A', // Red
                                        '#FFCC5A', // Yellow
                                        '#75FF5A', // Green
                                        '#5AD5FF', // Blue
                                        '#CC5AFF', // Purple
                                        '#FFFFFF', // White
                                    ].map((color) => (
                                        <button
                                            key={color}
                                            className="w-6 h-6 rounded-full border border-zinc-700"
                                            style={{ backgroundColor: color }}
                                            onClick={() => setCustomColor(color)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs text-zinc-400">Label (optional)</Label>
                            <Input
                                type="text"
                                placeholder="e.g. Fireball"
                                value={customLabel}
                                onChange={(e) => setCustomLabel(e.target.value)}
                                className="mt-1 text-xs"
                            />
                        </div>

                        <Button
                            variant="default"
                            size="sm"
                            className="w-full text-xs"
                            onClick={handleAddCustom}
                        >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Marker
                        </Button>
                    </div>
                )}

                {/* Markers Tab - List of active markers */}
                {!showSettings && activeTab === 'markers' && (
                    <div className="max-h-80 overflow-y-auto p-2">
                        {activeMarkers.length === 0 ? (
                            <div className="text-center py-4 text-zinc-500 text-sm">
                                No active markers
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeMarkers.map((marker) => (
                                    <div
                                        key={marker.id}
                                        className="flex items-center justify-between rounded-md bg-accent/10 p-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            {renderShapePreview(marker.shape, marker.color)}
                                            <span className="text-xs text-zinc-300">
                                                {marker.label || `${marker.shape} (${marker.sizeInFeet}&apos;)`}
                                            </span>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0"
                                                onClick={() => onHighlightMarker?.(marker.id)}
                                                title="Highlight"
                                            >
                                                <EyeIcon className="h-3.5 w-3.5 text-zinc-400" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                onClick={() => onDeleteMarker?.(marker.id)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Settings panel */}
                {showSettings && (
                    <div className="p-3 space-y-4">
                        {onAoeEffectThemeChange && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Animation theme</Label>
                                <Select
                                    value={aoeEffectTheme}
                                    onValueChange={(v) => onAoeEffectThemeChange(v as AoEEffectTheme)}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {AOE_EFFECT_THEMES.map((theme) => (
                                            <SelectItem key={theme} value={theme} className="text-xs">
                                                {AOE_THEME_LABELS[theme]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {onStagedRevealChange && (
                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="aoe-staged-reveal"
                                    checked={aoeStagedReveal}
                                    onCheckedChange={(c) => onStagedRevealChange(c === true)}
                                />
                                <div className="space-y-1">
                                    <Label htmlFor="aoe-staged-reveal" className="text-xs font-normal cursor-pointer leading-snug">
                                        Staged reveal (hide from viewers until triggered)
                                    </Label>
                                    <p className="text-xs text-zinc-500">
                                        New markers stay hidden from viewers until you right-click them on the map and choose Trigger.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}; 