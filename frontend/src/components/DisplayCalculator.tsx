import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Using divs instead of RadioGroup and Slider since those components might need extra setup
interface DisplayCalculatorProps {
    isOpen: boolean;
    onClose: () => void;
    currentGridSize: number;
    onApplyGridSize: (size: number) => void;
    gridSettings?: {
        showGrid: boolean;
        gridSize: number;
        gridColor?: string;
        gridOpacity?: number;
    };
    onUpdateGridSettings?: (settings: any) => void;
}

const RESOLUTIONS = {
    FULL_HD: { width: 1920, height: 1080, name: 'Full HD (1080p)' },
    FOUR_K: { width: 3840, height: 2160, name: '4K UHD' },
};

export const DisplayCalculator: React.FC<DisplayCalculatorProps> = ({
    isOpen,
    onClose,
    currentGridSize,
    onApplyGridSize,
    gridSettings,
    onUpdateGridSettings,
}) => {
    // Calculator state
    const [screenSize, setScreenSize] = useState(55);
    const [resolution, setResolution] = useState<'FULL_HD' | 'FOUR_K'>('FOUR_K');
    const [gridSize, setGridSize] = useState(currentGridSize);
    const [sqFtPerGrid, setSqFtPerGrid] = useState(5);

    // Grid settings state
    const [showGrid, setShowGrid] = useState(gridSettings?.showGrid ?? true);
    const [gridColor, setGridColor] = useState(gridSettings?.gridColor || 'rgba(255, 255, 255, 0.1)');
    const [gridOpacity, setGridOpacity] = useState(gridSettings?.gridOpacity || 0.5);

    // Active tab state
    const [activeTab, setActiveTab] = useState("calculator");

    // Recalculate when the props change
    useEffect(() => {
        setGridSize(currentGridSize);
        if (gridSettings) {
            setShowGrid(gridSettings.showGrid);
            setGridColor(gridSettings.gridColor || 'rgba(255, 255, 255, 0.1)');
            setGridOpacity(gridSettings.gridOpacity || 0.5);
        }
    }, [currentGridSize, gridSettings]);

    // Calculations for display metrics
    const diagonalPixels = Math.sqrt(
        Math.pow(RESOLUTIONS[resolution].width, 2) +
        Math.pow(RESOLUTIONS[resolution].height, 2)
    );

    const ppi = diagonalPixels / screenSize;
    const inchesPerGrid = sqFtPerGrid / 12; // Convert sq.ft to inches
    const pixelsPerGrid = Math.round(inchesPerGrid * ppi);

    // Calculate physical grid dimensions
    const gridPhysicalSize = gridSize / ppi;
    const gridsPerFootX = 12 / gridPhysicalSize;
    const gridsPerFootY = 12 / gridPhysicalSize;

    // Calculate total grid cells on screen
    const gridCellsX = Math.floor(RESOLUTIONS[resolution].width / gridSize);
    const gridCellsY = Math.floor(RESOLUTIONS[resolution].height / gridSize);
    const totalGridCells = gridCellsX * gridCellsY;

    // Calculate physical map size
    const mapWidthFeet = gridCellsX / gridsPerFootX;
    const mapHeightFeet = gridCellsY / gridsPerFootY;

    const handleApplyCalculator = () => {
        onApplyGridSize(gridSize);
        onClose();
    };

    const handleApplyGridSettings = () => {
        if (onUpdateGridSettings) {
            onUpdateGridSettings({
                showGrid,
                gridSize,
                gridColor,
                gridOpacity
            });
        }
        onClose();
    };

    const handleApplyAll = () => {
        if (onUpdateGridSettings) {
            onUpdateGridSettings({
                showGrid,
                gridSize,
                gridColor,
                gridOpacity
            });
        } else {
            onApplyGridSize(gridSize);
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Grid Settings</DialogTitle>
                    <DialogDescription>
                        Configure grid appearance and calculate optimal display settings
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="settings" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid grid-cols-2 mb-4">
                        <TabsTrigger value="settings">Grid Settings</TabsTrigger>
                        <TabsTrigger value="calculator">Display Calculator</TabsTrigger>
                    </TabsList>

                    <TabsContent value="settings" className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="grid-toggle" className="text-sm text-foreground">Show Grid</Label>
                            <div className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="grid-toggle"
                                    checked={showGrid}
                                    onChange={() => setShowGrid(!showGrid)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="grid-size" className="text-sm">Grid Size (pixels)</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="grid-size-slider"
                                    type="range"
                                    min="10"
                                    max="100"
                                    step="5"
                                    value={gridSize}
                                    onChange={(e) => setGridSize(Number(e.target.value))}
                                    className="w-full"
                                />
                                <Input
                                    id="grid-size"
                                    type="number"
                                    min="10"
                                    max="100"
                                    step="5"
                                    value={gridSize}
                                    onChange={(e) => setGridSize(Number(e.target.value))}
                                    className="w-16 text-center"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="grid-color" className="text-sm">Grid Color</Label>
                            <div className="flex gap-2">
                                <input
                                    id="grid-color"
                                    type="color"
                                    value={gridColor}
                                    onChange={(e) => setGridColor(e.target.value)}
                                    className="w-12 h-8 p-1 border border-zinc-700 rounded"
                                />
                                <div className="grid grid-cols-6 gap-1 flex-1">
                                    {[
                                        'rgba(255, 255, 255, 0.3)', // White with opacity
                                        'rgba(255, 90, 90, 0.3)',    // Red with opacity
                                        'rgba(255, 204, 90, 0.3)',   // Yellow with opacity
                                        'rgba(117, 255, 90, 0.3)',   // Green with opacity
                                        'rgba(90, 213, 255, 0.3)',   // Blue with opacity
                                        'rgba(204, 90, 255, 0.3)',   // Purple with opacity
                                    ].map((color) => (
                                        <button
                                            key={color}
                                            className={`w-6 h-6 rounded-full border ${gridColor === color ? 'border-white' : 'border-zinc-700'}`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setGridColor(color)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="grid-opacity" className="text-sm">
                                Grid Opacity ({Math.round(gridOpacity * 100)}%)
                            </Label>
                            <input
                                id="grid-opacity"
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.05"
                                value={gridOpacity}
                                onChange={(e) => setGridOpacity(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg mt-4">
                            <div className="flex items-center mb-2">
                                <div className="h-3 w-3 rounded-sm border border-zinc-700 mr-2"
                                    style={{
                                        backgroundImage: `
                                            linear-gradient(to right, ${gridColor} 1px, transparent 1px),
                                            linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
                                        `,
                                        backgroundSize: '5px 5px',
                                        opacity: gridOpacity
                                    }}
                                />
                                <span className="text-xs text-zinc-400">Grid Preview</span>
                            </div>
                            <p className="text-xs text-zinc-500">Grid size: {gridSize}px — Opacity: {Math.round(gridOpacity * 100)}%</p>
                        </div>
                    </TabsContent>

                    <TabsContent value="calculator" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="screen-size">Screen Size (inches)</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="screen-size-slider"
                                    type="range"
                                    min={24}
                                    max={85}
                                    step={1}
                                    value={screenSize}
                                    onChange={(e) => setScreenSize(Number(e.target.value))}
                                    className="flex-1"
                                />
                                <Input
                                    id="screen-size"
                                    type="number"
                                    min={24}
                                    max={85}
                                    value={screenSize}
                                    onChange={(e) => setScreenSize(Number(e.target.value))}
                                    className="w-16 text-center"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Resolution</Label>
                            <div className="flex space-x-4">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="full-hd"
                                        checked={resolution === 'FULL_HD'}
                                        onChange={() => setResolution('FULL_HD')}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor="full-hd">Full HD (1080p)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="four-k"
                                        checked={resolution === 'FOUR_K'}
                                        onChange={() => setResolution('FOUR_K')}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor="four-k">4K UHD</Label>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="grid-size">Grid Size (pixels)</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="grid-size-slider-calc"
                                    type="range"
                                    min={10}
                                    max={100}
                                    step={5}
                                    value={gridSize}
                                    onChange={(e) => setGridSize(Number(e.target.value))}
                                    className="flex-1"
                                />
                                <Input
                                    id="grid-size-calc"
                                    type="number"
                                    min={10}
                                    max={100}
                                    step={5}
                                    value={gridSize}
                                    onChange={(e) => setGridSize(Number(e.target.value))}
                                    className="w-16 text-center"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="sq-ft-grid">Grid Square Size (feet)</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="sq-ft-grid-slider"
                                    type="range"
                                    min={5}
                                    max={10}
                                    step={5}
                                    value={sqFtPerGrid}
                                    onChange={(e) => setSqFtPerGrid(Number(e.target.value))}
                                    className="flex-1"
                                />
                                <Input
                                    id="sq-ft-grid"
                                    type="number"
                                    min={5}
                                    max={10}
                                    step={5}
                                    value={sqFtPerGrid}
                                    onChange={(e) => setSqFtPerGrid(Number(e.target.value))}
                                    className="w-16 text-center"
                                />
                            </div>
                        </div>

                        <div className="mt-6 space-y-2 p-4 border border-zinc-800 rounded-lg bg-zinc-900/50">
                            <h3 className="text-sm font-medium text-zinc-300">Display Metrics</h3>

                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="text-xs text-zinc-400">Resolution:</div>
                                <div className="text-xs text-zinc-200">{RESOLUTIONS[resolution].width} × {RESOLUTIONS[resolution].height}</div>

                                <div className="text-xs text-zinc-400">Pixels Per Inch (PPI):</div>
                                <div className="text-xs text-zinc-200">{ppi.toFixed(1)}</div>

                                <div className="text-xs text-zinc-400">Grid Size in Pixels:</div>
                                <div className="text-xs text-zinc-200">{gridSize}px</div>

                                <div className="text-xs text-zinc-400">Physical Grid Size:</div>
                                <div className="text-xs text-zinc-200">{gridPhysicalSize.toFixed(2)} inches</div>

                                <div className="text-xs text-zinc-400">Grids Per Foot:</div>
                                <div className="text-xs text-zinc-200">{gridsPerFootX.toFixed(1)}</div>

                                <div className="text-xs text-zinc-400">Grid Cells on Screen:</div>
                                <div className="text-xs text-zinc-200">{gridCellsX} × {gridCellsY} = {totalGridCells} cells</div>

                                <div className="text-xs text-zinc-400">Map Size in Feet:</div>
                                <div className="text-xs text-zinc-200">{mapWidthFeet.toFixed(1)}' × {mapHeightFeet.toFixed(1)}' (approx.)</div>
                            </div>

                            <div className="mt-3 text-xs text-zinc-400">
                                <span className="font-medium">Recommended grid size: </span>
                                <span className="text-emerald-500 font-medium">{pixelsPerGrid}px</span>
                                <button
                                    className="ml-2 text-blue-400 hover:text-blue-300"
                                    onClick={() => setGridSize(pixelsPerGrid)}
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleApplyAll}>
                        Apply Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 