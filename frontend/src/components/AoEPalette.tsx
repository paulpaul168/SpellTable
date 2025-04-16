import React, { useState } from 'react';
import { AoEShape, AoEMarker } from '../types/map';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Zap,
    Circle,
    PlusCircle,
    Triangle,
    Minus,
    Square,
    Box,
    Cylinder as CylinderIcon,
    X,
    ChevronDown,
    ChevronUp,
    PanelLeftClose,
} from 'lucide-react';
import { cn } from '../lib/utils';

// Define a simple slider component since we don't have access to the slider component
const SimpleSlider: React.FC<{
    value: number[];
    min: number;
    max: number;
    step: number;
    onValueChange: (values: number[]) => void;
    className?: string;
}> = ({ value, min, max, step, onValueChange, className }) => {
    return (
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value[0]}
            onChange={(e) => onValueChange([Number(e.target.value)])}
            className={className}
            style={{ width: '100%' }}
        />
    );
};

interface AoEPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onAddMarker: (marker: Omit<AoEMarker, 'id' | 'position'>) => void;
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

// Common D&D spells with AoE
const commonSpells = [
    { name: 'Fireball', shape: 'circle', size: 20, color: '#FF5A5A' },
    { name: 'Burning Hands', shape: 'cone', size: 15, color: '#FF5A5A' },
    { name: 'Lightning Bolt', shape: 'line', size: 100, color: '#5AD5FF' },
    { name: 'Cone of Cold', shape: 'cone', size: 60, color: '#5AD5FF' },
    { name: 'Wall of Fire', shape: 'line', size: 60, color: '#FF5A5A' },
    { name: 'Cloudkill', shape: 'circle', size: 20, color: '#C9E265' },
    { name: 'Spirit Guardians', shape: 'circle', size: 15, color: '#CC5AFF' },
    { name: 'Web', shape: 'cube', size: 20, color: '#FFFFFF' },
    { name: 'Darkness', shape: 'circle', size: 15, color: '#000000' },
    { name: 'Fog Cloud', shape: 'circle', size: 20, color: '#C9C9C9' },
];

export const AoEPalette: React.FC<AoEPaletteProps> = ({
    isOpen,
    onClose,
    onAddMarker,
}) => {
    const [activeTab, setActiveTab] = useState<'shapes' | 'spells' | 'custom'>('shapes');
    const [customShape, setCustomShape] = useState<AoEShape>('circle');
    const [customSize, setCustomSize] = useState(20);
    const [customColor, setCustomColor] = useState('#FF5A5A');
    const [customLabel, setCustomLabel] = useState('');
    const [opacity, setOpacity] = useState(0.5);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Function to handle adding from presets
    const handleAddFromPreset = (shape: AoEShape, size: number, color: string, label?: string) => {
        onAddMarker({
            shape,
            sizeInFeet: size,
            color,
            rotation: 0,
            opacity,
            label
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

    if (!isOpen) return null;

    return (
        <div className={cn(
            "fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-zinc-900/90 backdrop-blur-sm rounded-lg border border-zinc-800 shadow-xl transition-all duration-200",
            isCollapsed ? "w-10" : "w-72"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between p-2 border-b border-zinc-800">
                {!isCollapsed && (
                    <h3 className="text-sm font-medium text-zinc-300">AoE Markers</h3>
                )}
                <div className="flex gap-1 ml-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                    >
                        {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
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

            {/* Content - only show when not collapsed */}
            {!isCollapsed && (
                <>
                    {/* Tabs */}
                    <div className="flex items-center p-2 border-b border-zinc-800">
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
                    </div>

                    {/* Opacity control - common to all tabs */}
                    <div className="px-3 pt-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-zinc-400">Opacity: {Math.round(opacity * 100)}%</Label>
                        </div>
                        <SimpleSlider
                            value={[opacity * 100]}
                            min={10}
                            max={90}
                            step={5}
                            onValueChange={(values) => setOpacity(values[0] / 100)}
                            className="mt-1.5"
                        />
                    </div>

                    {/* Shapes Tab */}
                    {activeTab === 'shapes' && (
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
                                        <div
                                            className="w-3 h-3 mr-2 rounded-full"
                                            style={{ backgroundColor: aoe.color }}
                                        />
                                        {aoe.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Spells Tab */}
                    {activeTab === 'spells' && (
                        <div className="max-h-80 overflow-y-auto p-2">
                            <div className="grid grid-cols-1 gap-2">
                                {commonSpells.map((spell, index) => (
                                    <Button
                                        key={index}
                                        variant="outline"
                                        size="sm"
                                        className="text-xs justify-start"
                                        onClick={() => handleAddFromPreset(
                                            spell.shape as AoEShape,
                                            spell.size,
                                            spell.color,
                                            spell.name
                                        )}
                                    >
                                        <div
                                            className="w-3 h-3 mr-2 rounded-full"
                                            style={{ backgroundColor: spell.color }}
                                        />
                                        {spell.name} ({spell.size}')
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Tab */}
                    {activeTab === 'custom' && (
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
                                        5'
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => setCustomSize(15)}
                                    >
                                        15'
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => setCustomSize(30)}
                                    >
                                        30'
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
                </>
            )}
        </div>
    );
}; 