import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from './ui/checkbox';
import { toast } from '@/components/ui/use-toast';

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
        gridCellsX?: number;
        gridCellsY?: number;
        useFixedGrid?: boolean;
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

    // Grid layout state
    const [useFixedGrid, setUseFixedGrid] = useState(gridSettings?.useFixedGrid || false);
    const [gridCellsX, setGridCellsX] = useState(gridSettings?.gridCellsX || 25);
    const [gridCellsY, setGridCellsY] = useState(gridSettings?.gridCellsY || 13);

    // Active tab state
    const [activeTab, setActiveTab] = useState("settings");

    // Recalculate when the props change
    useEffect(() => {
        setGridSize(currentGridSize);
        if (gridSettings) {
            setShowGrid(gridSettings.showGrid);
            setGridColor(gridSettings.gridColor || 'rgba(255, 255, 255, 0.1)');
            setGridOpacity(gridSettings.gridOpacity || 0.5);
            setUseFixedGrid(gridSettings.useFixedGrid || false);
            setGridCellsX(gridSettings.gridCellsX || 25);
            setGridCellsY(gridSettings.gridCellsY || 13);
        }
    }, [currentGridSize, gridSettings]);

    // Calculation for optimal grid size based on viewport
    useEffect(() => {
        if (isOpen && useFixedGrid && typeof window !== 'undefined') {
            // Calculate the best grid size to fit the specified grid cells
            const optimalGridSizeX = Math.floor(window.innerWidth / gridCellsX);
            const optimalGridSizeY = Math.floor(window.innerHeight / gridCellsY);

            // Use the smaller value to ensure grid fits in viewport
            const optimalSize = Math.min(optimalGridSizeX, optimalGridSizeY);

            // Update the grid size if different from current
            if (optimalSize !== gridSize && optimalSize > 0) {
                setGridSize(optimalSize);
            }
        }
    }, [isOpen, useFixedGrid, gridCellsX, gridCellsY]);

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
    const totalGridCellsX = useFixedGrid ? gridCellsX : Math.floor(RESOLUTIONS[resolution].width / gridSize);
    const totalGridCellsY = useFixedGrid ? gridCellsY : Math.floor(RESOLUTIONS[resolution].height / gridSize);
    const totalGridCells = totalGridCellsX * totalGridCellsY;

    // Calculate physical map size
    const mapWidthFeet = totalGridCellsX / gridsPerFootX;
    const mapHeightFeet = totalGridCellsY / gridsPerFootY;

    // Calculate grid size based on fixed grid if enabled
    const calculatedGridSize = useFixedGrid
        ? Math.floor(Math.min(
            typeof window !== 'undefined' ? window.innerWidth / gridCellsX : 50,
            typeof window !== 'undefined' ? window.innerHeight / gridCellsY : 50
        ))
        : gridSize;

    // Add a new function to help users set up common display resolutions
    const applyViewportOptimizedGrid = (width: number, height: number) => {
        // Set to fixed grid mode
        setUseFixedGrid(true);

        // Set cells based on the given dimensions
        setGridCellsX(width);
        setGridCellsY(height);

        // Calculate optimal grid size
        if (typeof window !== 'undefined') {
            const optimalGridSizeX = Math.floor(window.innerWidth / width);
            const optimalGridSizeY = Math.floor(window.innerHeight / height);
            const optimal = Math.min(optimalGridSizeX, optimalGridSizeY);

            if (optimal > 0) {
                setGridSize(optimal);
            }
        }
    };

    const handleApplyCalculator = () => {
        onApplyGridSize(useFixedGrid ? calculatedGridSize : gridSize);
        onClose();
    };

    const handleApplyGridSettings = () => {
        if (onUpdateGridSettings) {
            onUpdateGridSettings({
                showGrid,
                gridSize: useFixedGrid ? calculatedGridSize : gridSize,
                gridColor,
                gridOpacity,
                useFixedGrid,
                gridCellsX,
                gridCellsY
            });

            // When we apply new grid settings, show a message about existing elements
            if (useFixedGrid) {
                toast({
                    title: "Grid Layout Updated",
                    description: "Map and AoE positions will now use grid coordinates.",
                    duration: 3000,
                });
            }
        }
        onClose();
    };

    const handleApplyAll = () => {
        if (onUpdateGridSettings) {
            onUpdateGridSettings({
                showGrid,
                gridSize: useFixedGrid ? calculatedGridSize : gridSize,
                gridColor,
                gridOpacity,
                useFixedGrid,
                gridCellsX,
                gridCellsY
            });
        } else {
            onApplyGridSize(useFixedGrid ? calculatedGridSize : gridSize);
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
                    <TabsList className="grid grid-cols-3 mb-4">
                        <TabsTrigger value="settings">Grid Settings</TabsTrigger>
                        <TabsTrigger value="layout">Grid Layout</TabsTrigger>
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

                        {!useFixedGrid && (
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
                        )}

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
                            <p className="text-xs text-zinc-500">
                                {useFixedGrid
                                    ? `Fixed grid: ${gridCellsX}×${gridCellsY} cells`
                                    : `Grid size: ${gridSize}px`} — Opacity: {Math.round(gridOpacity * 100)}%
                            </p>
                        </div>
                    </TabsContent>

                    <TabsContent value="layout" className="space-y-4">
                        <div className="space-y-2 mt-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="fixed-grid-toggle" className="text-sm text-foreground">
                                    Use Fixed Grid Layout
                                </Label>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        id="fixed-grid-toggle"
                                        checked={useFixedGrid}
                                        onChange={() => setUseFixedGrid(!useFixedGrid)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </div>
                            </div>

                            {useFixedGrid && (
                                <>
                                    <div className="flex gap-4 mt-2">
                                        <div className="space-y-2 flex-1">
                                            <Label htmlFor="grid-cells-x" className="text-sm">Grid Width (cells)</Label>
                                            <Input
                                                id="grid-cells-x"
                                                type="number"
                                                min="5"
                                                max="100"
                                                value={gridCellsX}
                                                onChange={(e) => setGridCellsX(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="space-y-2 flex-1">
                                            <Label htmlFor="grid-cells-y" className="text-sm">Grid Height (cells)</Label>
                                            <Input
                                                id="grid-cells-y"
                                                type="number"
                                                min="5"
                                                max="100"
                                                value={gridCellsY}
                                                onChange={(e) => setGridCellsY(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        <div className="p-2 bg-zinc-900 border border-zinc-800 rounded text-xs">
                                            <p>When using fixed grid:</p>
                                            <ul className="list-disc pl-4 mt-1 space-y-1">
                                                <li>Grid will always contain exactly {gridCellsX}×{gridCellsY} cells</li>
                                                <li>Calculated grid size: {calculatedGridSize}px per cell</li>
                                                <li>All AoE markers will align to this grid</li>
                                            </ul>

                                            <div className="flex gap-2 mt-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="text-xs flex-1"
                                                    onClick={() => {
                                                        setGridCellsX(18);
                                                        setGridCellsY(32);
                                                    }}
                                                >
                                                    18×32
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="text-xs flex-1"
                                                    onClick={() => {
                                                        setGridCellsX(20);
                                                        setGridCellsY(30);
                                                    }}
                                                >
                                                    20×30
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="text-xs flex-1"
                                                    onClick={() => {
                                                        setGridCellsX(24);
                                                        setGridCellsY(42);
                                                    }}
                                                >
                                                    24×42
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {!useFixedGrid && (
                            <div className="mt-4 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                                <h3 className="text-sm font-medium text-zinc-300 mb-2">Viewport-Relative Scaling</h3>
                                <p className="text-xs text-zinc-400 mb-3">
                                    These presets will create a grid that scales consistently across different display sizes.
                                    Maps and AoE markers will align properly between admin and player views.
                                </p>

                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => applyViewportOptimizedGrid(32, 18)}
                                    >
                                        32×18 Grid
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => applyViewportOptimizedGrid(20, 30)}
                                    >
                                        20×30 Grid
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => applyViewportOptimizedGrid(24, 42)}
                                    >
                                        24×42 Grid
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => applyViewportOptimizedGrid(25, 13)}
                                    >
                                        25×13 Grid (Wide)
                                    </Button>
                                </div>
                            </div>
                        )}
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
                                <div className="text-xs text-zinc-200">{useFixedGrid ? calculatedGridSize : gridSize}px</div>

                                <div className="text-xs text-zinc-400">Physical Grid Size:</div>
                                <div className="text-xs text-zinc-200">{gridPhysicalSize.toFixed(2)} inches</div>

                                <div className="text-xs text-zinc-400">Grids Per Foot:</div>
                                <div className="text-xs text-zinc-200">{gridsPerFootX.toFixed(1)}</div>

                                <div className="text-xs text-zinc-400">Grid Cells on Screen:</div>
                                <div className="text-xs text-zinc-200">{totalGridCellsX} × {totalGridCellsY} = {totalGridCells} cells</div>

                                <div className="text-xs text-zinc-400">Map Size in Feet:</div>
                                <div className="text-xs text-zinc-200">{mapWidthFeet.toFixed(1)}&apos; × {mapHeightFeet.toFixed(1)}&apos; (approx.)</div>
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