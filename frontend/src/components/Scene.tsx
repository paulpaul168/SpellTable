import React, { useState, useEffect } from 'react';
import { Scene as SceneType, MapData } from '../types/map';
import { Map } from './Map';
import { websocketService } from '../services/websocket';
import { UploadDialog } from './UploadDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    LayoutGrid,
    Upload,
    Wifi,
    WifiOff,
    Plus,
    Image as ImageIcon,
    Settings,
    Users,
    Grid,
    Eye,
    EyeOff,
    ChevronDown,
    Save,
    FolderOpen,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";

interface SceneProps {
    initialScene: SceneType;
}

export const Scene: React.FC<SceneProps> = ({ initialScene }) => {
    const [scene, setScene] = useState<SceneType>(initialScene);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [showGrid, setShowGrid] = useState(true);

    useEffect(() => {
        websocketService.connect();

        const unsubscribe = websocketService.addListener((data) => {
            console.log('Received data:', data);
            if (data.type === 'scene_update' && data.scene) {
                setScene(data.scene);
            } else if (data.type === 'connection_status') {
                setConnectionStatus(data.status || 'unknown');
            }
        });

        return () => {
            unsubscribe();
            websocketService.disconnect();
        };
    }, []);

    const handleMapUpdate = (updatedMap: MapData) => {
        const updatedScene = {
            ...scene,
            maps: scene.maps.map(m => m.name === updatedMap.name ? updatedMap : m)
        };
        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
    };

    const handleMapSelect = (mapName: string) => {
        setScene({
            ...scene,
            activeMapId: mapName
        });
    };

    const handleUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:8010/maps/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            const newMap: MapData = {
                name: data.filename,
                data: {
                    position: { x: 0, y: 0 },
                    scale: 1,
                    rotation: 0,
                    gridSize: 50,
                    showGrid: true
                }
            };

            const updatedScene = {
                ...scene,
                maps: [...scene.maps, newMap],
                activeMapId: newMap.name
            };

            setScene(updatedScene);
            websocketService.send({
                type: 'scene_update',
                scene: updatedScene
            });
        } catch (error) {
            console.error('Error uploading map:', error);
        }
    };

    const handleSaveScene = async () => {
        try {
            const response = await fetch('http://localhost:8010/scenes/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scene),
            });

            if (!response.ok) {
                throw new Error('Failed to save scene');
            }

            const data = await response.json();
            console.log('Scene saved:', data);
        } catch (error) {
            console.error('Error saving scene:', error);
        }
    };

    const handleLoadScene = async () => {
        try {
            const response = await fetch('http://localhost:8010/scenes/load', {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to load scene');
            }

            const data = await response.json();
            setScene(data);
            websocketService.send({
                type: 'scene_update',
                scene: data
            });
        } catch (error) {
            console.error('Error loading scene:', error);
        }
    };

    return (
        <div className="flex h-screen bg-zinc-950 overflow-hidden" style={{ height: '100vh', width: '100vw', margin: 0, padding: 0 }}>
            {/* Main Content */}
            <div className="flex-1 relative w-full h-full overflow-hidden" style={{ height: '100%', width: '100%', margin: 0, padding: 0 }}>
                {scene.maps.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="p-4 rounded-xl bg-zinc-900/30">
                            <ImageIcon className="h-8 w-8 text-zinc-700" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-zinc-300">Welcome to SpellTable</h3>
                            <p className="text-xs text-zinc-600">Upload your first map to get started</p>
                        </div>
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => setIsUploadOpen(true)}
                        >
                            <Upload className="h-4 w-4" />
                            <span className="text-xs">Upload Map</span>
                        </Button>
                    </div>
                )}
                {scene.maps.map(map => (
                    <Map
                        key={map.name}
                        map={map}
                        isActive={map.name === scene.activeMapId}
                        onUpdate={handleMapUpdate}
                    />
                ))}

                {/* Floating Menu Button */}
                <div className="absolute top-4 left-4 z-50">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 bg-zinc-900/80 backdrop-blur-sm">
                                <LayoutGrid className="h-4 w-4" />
                                <span>Menu</span>
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 bg-zinc-900/95 backdrop-blur-sm border-zinc-800">
                            {/* Connection Status */}
                            <div className="px-2 py-1.5">
                                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-zinc-800/50">
                                    {connectionStatus === 'connected' ? (
                                        <>
                                            <Wifi className="h-3 w-3 text-emerald-500" />
                                            <span className="text-[10px] text-emerald-500">Connected</span>
                                        </>
                                    ) : (
                                        <>
                                            <WifiOff className="h-3 w-3 text-zinc-600" />
                                            <span className="text-[10px] text-zinc-600 capitalize">{connectionStatus}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <DropdownMenuSeparator className="bg-zinc-800" />

                            {/* Maps Section */}
                            <div className="px-2 py-1">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <ImageIcon className="h-4 w-4 text-zinc-400" />
                                    <span className="text-xs font-medium text-zinc-300">Maps</span>
                                </div>
                                <div className="space-y-1 mt-1">
                                    {scene.maps.map(map => (
                                        <DropdownMenuItem
                                            key={map.name}
                                            className={cn(
                                                "text-xs cursor-pointer",
                                                map.name === scene.activeMapId && "bg-zinc-800"
                                            )}
                                            onClick={() => handleMapSelect(map.name)}
                                        >
                                            <ImageIcon className="h-4 w-4 mr-2" />
                                            {map.name}
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuItem
                                        className="text-xs cursor-pointer"
                                        onClick={() => setIsUploadOpen(true)}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add New Map
                                    </DropdownMenuItem>
                                </div>
                            </div>

                            <DropdownMenuSeparator className="bg-zinc-800" />

                            {/* Scene Management */}
                            <div className="px-2 py-1">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Settings className="h-4 w-4 text-zinc-400" />
                                    <span className="text-xs font-medium text-zinc-300">Scene</span>
                                </div>
                                <div className="space-y-1 mt-1">
                                    <DropdownMenuItem
                                        className="text-xs cursor-pointer"
                                        onClick={handleSaveScene}
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        Save Scene
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-xs cursor-pointer"
                                        onClick={handleLoadScene}
                                    >
                                        <FolderOpen className="h-4 w-4 mr-2" />
                                        Load Scene
                                    </DropdownMenuItem>
                                </div>
                            </div>

                            <DropdownMenuSeparator className="bg-zinc-800" />

                            {/* Players Section */}
                            <div className="px-2 py-1">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Users className="h-4 w-4 text-zinc-400" />
                                    <span className="text-xs font-medium text-zinc-300">Players</span>
                                </div>
                                <DropdownMenuItem className="text-xs cursor-pointer">
                                    <Users className="h-4 w-4 mr-2" />
                                    Connected Players (1)
                                </DropdownMenuItem>
                            </div>

                            <DropdownMenuSeparator className="bg-zinc-800" />

                            {/* Settings Section */}
                            <div className="px-2 py-1">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Settings className="h-4 w-4 text-zinc-400" />
                                    <span className="text-xs font-medium text-zinc-300">Settings</span>
                                </div>
                                <div className="space-y-1 mt-1">
                                    <DropdownMenuItem className="text-xs cursor-pointer">
                                        <Grid className="h-4 w-4 mr-2" />
                                        Grid Size (50px)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-xs cursor-pointer"
                                        onClick={() => setShowGrid(!showGrid)}
                                    >
                                        {showGrid ? (
                                            <Eye className="h-4 w-4 mr-2" />
                                        ) : (
                                            <EyeOff className="h-4 w-4 mr-2" />
                                        )}
                                        {showGrid ? 'Hide Grid' : 'Show Grid'}
                                    </DropdownMenuItem>
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <UploadDialog
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onUpload={handleUpload}
            />
        </div>
    );
}; 