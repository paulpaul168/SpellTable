import React, { useState } from 'react';
import { FogOfWar as FogOfWarType } from '../types/map';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { X, Eye, Square, Triangle, Circle, Pentagon, Hexagon, Trash2 } from 'lucide-react';

interface FogOfWarPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onAddFogOfWar: (fogOfWarData: Omit<FogOfWarType, 'id'>) => void;
    activeFogOfWar?: FogOfWarType[];
    onDeleteFogOfWar: (fogOfWarId: string) => void;
}

export const FogOfWarPalette: React.FC<FogOfWarPaletteProps> = ({
    isOpen,
    onClose,
    onAddFogOfWar,
    activeFogOfWar = [],
    onDeleteFogOfWar,
}) => {
    const [activeTab, setActiveTab] = useState<'shapes' | 'custom' | 'active'>('shapes');
    const [customColor, setCustomColor] = useState('#000000');
    const [opacity, setOpacity] = useState(0.7);

    // Function to create different shaped polygons
    const createShapePoints = (shape: string, centerX: number, centerY: number, size: number): Array<{ x: number; y: number }> => {
        const points: Array<{ x: number; y: number }> = [];

        switch (shape) {
            case 'square':
                return [
                    { x: centerX - size, y: centerY - size },
                    { x: centerX + size, y: centerY - size },
                    { x: centerX + size, y: centerY + size },
                    { x: centerX - size, y: centerY + size }
                ];
            case 'triangle':
                return [
                    { x: centerX, y: centerY - size },
                    { x: centerX + size, y: centerY + size },
                    { x: centerX - size, y: centerY + size }
                ];
            case 'circle':
                const sides = 12;
                for (let i = 0; i < sides; i++) {
                    const angle = (i * 2 * Math.PI) / sides;
                    points.push({
                        x: centerX + size * Math.cos(angle),
                        y: centerY + size * Math.sin(angle)
                    });
                }
                return points;
            case 'pentagon':
                const pentagonSides = 5;
                for (let i = 0; i < pentagonSides; i++) {
                    const angle = (i * 2 * Math.PI) / pentagonSides - Math.PI / 2;
                    points.push({
                        x: centerX + size * Math.cos(angle),
                        y: centerY + size * Math.sin(angle)
                    });
                }
                return points;
            case 'hexagon':
                const hexagonSides = 6;
                for (let i = 0; i < hexagonSides; i++) {
                    const angle = (i * 2 * Math.PI) / hexagonSides;
                    points.push({
                        x: centerX + size * Math.cos(angle),
                        y: centerY + size * Math.sin(angle)
                    });
                }
                return points;
            default:
                return [];
        }
    };

    // Function to handle adding fog of war from presets
    const handleAddFromPreset = (shape: string, color: string, opacity: number) => {
        // Create points for the shape at the center of the screen
        const centerX = 9; // Center of grid (assuming 18x32 grid)
        const centerY = 16; // Center of grid
        const size = 3; // Size in grid cells

        const points = createShapePoints(shape, centerX, centerY, size);

        if (points.length > 0) {
            onAddFogOfWar({
                points,
                useGridCoordinates: true,
                color,
                opacity
            });
        }
    };

    // Function to handle adding custom fog of war
    const handleAddCustom = () => {
        // Create a simple square as starting point
        const centerX = 9;
        const centerY = 16;
        const size = 3;

        const points = createShapePoints('square', centerX, centerY, size);

        onAddFogOfWar({
            points,
            useGridCoordinates: true,
            color: customColor,
            opacity
        });
    };

    // Preset shapes with icons
    const presetShapes = [
        { shape: 'square', icon: Square, color: '#000000', label: 'Square' },
        { shape: 'triangle', icon: Triangle, color: '#1a1a1a', label: 'Triangle' },
        { shape: 'circle', icon: Circle, color: '#2a2a2a', label: 'Circle' },
        { shape: 'pentagon', icon: Pentagon, color: '#3a3a3a', label: 'Pentagon' },
        { shape: 'hexagon', icon: Hexagon, color: '#4a4a4a', label: 'Hexagon' }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Fog of War
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="shapes">Preset Shapes</TabsTrigger>
                        <TabsTrigger value="custom">Custom</TabsTrigger>
                        <TabsTrigger value="active">
                            Active ({activeFogOfWar.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="shapes" className="space-y-4">
                        <div className="text-sm text-zinc-400">
                            Click to add a fog of war area. You can edit points by dragging them after creation.
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {presetShapes.map((preset) => (
                                <Button
                                    key={preset.shape}
                                    variant="outline"
                                    className="h-20 flex-col gap-2"
                                    onClick={() => handleAddFromPreset(preset.shape, preset.color, opacity)}
                                >
                                    <preset.icon className="h-6 w-6" />
                                    <span className="text-xs">{preset.label}</span>
                                </Button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="opacity">Opacity: {Math.round(opacity * 100)}%</Label>
                            <Input
                                id="opacity"
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={opacity}
                                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="custom" className="space-y-4">
                        <div className="text-sm text-zinc-400">
                            Create a custom fog of war area. You can reshape it by dragging the points after creation.
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="customColor">Color</Label>
                                <Input
                                    id="customColor"
                                    type="color"
                                    value={customColor}
                                    onChange={(e) => setCustomColor(e.target.value)}
                                    className="w-full h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customOpacity">Opacity: {Math.round(opacity * 100)}%</Label>
                                <Input
                                    id="customOpacity"
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={opacity}
                                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleAddCustom}
                            className="w-full"
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            Add Custom Fog
                        </Button>
                    </TabsContent>

                    <TabsContent value="active" className="space-y-4">
                        <div className="text-sm text-zinc-400">
                            Manage active fog of war areas. Use the delete button below to remove areas.
                        </div>

                        {activeFogOfWar.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500">
                                No active fog of war areas
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {activeFogOfWar.map((fog, index) => (
                                    <div
                                        key={fog.id}
                                        className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-4 h-4 rounded border border-zinc-600"
                                                style={{ backgroundColor: fog.color }}
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">
                                                    Fog Area {index + 1}
                                                </span>
                                                <span className="text-xs text-zinc-400">
                                                    {fog.points.length} points • {Math.round(fog.opacity * 100)}% opacity
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-xs">
                                                {fog.useGridCoordinates ? 'Grid' : 'Pixel'}
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onDeleteFogOfWar(fog.id)}
                                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <div className="flex justify-between items-center pt-4 border-t">
                    <div className="text-xs text-zinc-500">
                        Tip: Ctrl+Drag to move, Shift+Left click to add points, Double-click points to remove
                    </div>
                    <Button onClick={onClose} variant="outline">
                        <X className="h-4 w-4 mr-2" />
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}; 