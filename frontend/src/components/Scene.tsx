"use client"

import React, { useState, useEffect } from 'react';
import { Scene as SceneType, MapData } from '../types/map';
import { Map } from './Map';
import { websocketService } from '../services/websocket';
import { UploadDialog } from './UploadDialog';
import { Button } from '@/components/ui/button';
import {
    LayoutGrid,
    Users,
    Wifi,
    ChevronDown,
    Upload,
    Save,
    Image as ImageIcon,
    Settings,
    FolderOpen,
    ExternalLink,
    Grid,
    Eye,
    EyeOff,
    Music
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { SaveSceneDialog } from './SaveSceneDialog';
import { LoadSceneDialog } from './LoadSceneDialog';
import { MapListSidebar } from './MapListSidebar';
import { useToast } from "@/components/ui/use-toast";
import { InitiativeSidebar } from './InitiativeSidebar';
import { InitiativeEntry } from '../types/map';
import { SceneManagement } from './SceneManagement';
import { Soundboard } from './Soundboard';
import { cn } from '@/lib/utils';
import { InitiativeIndicator } from './InitiativeIndicator';

interface SceneProps {
    initialScene?: SceneType;
    isAdmin?: boolean;
}

interface SceneOperationStatusDialogProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'success' | 'error' | 'info';
    message: string;
}

const SceneOperationStatusDialog: React.FC<SceneOperationStatusDialogProps> = ({
    isOpen,
    onClose,
    type,
    message,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                        {type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p className="text-gray-700">{message}</p>
            </div>
        </div>
    );
};

export const Scene: React.FC<SceneProps> = ({ initialScene, isAdmin = false }) => {
    const { toast } = useToast();
    const [scene, setScene] = useState<SceneType>({
        id: initialScene?.id || 'default',
        name: initialScene?.name || 'Default Scene',
        maps: initialScene?.maps || [],
        activeMapId: initialScene?.activeMapId || null,
        gridSettings: initialScene?.gridSettings || {
            showGrid: true,
            gridSize: 50
        },
        initiativeOrder: initialScene?.initiativeOrder || [],
        showCurrentPlayer: true,
    });
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isSaveSceneOpen, setIsSaveSceneOpen] = useState(false);
    const [isLoadSceneOpen, setIsLoadSceneOpen] = useState(false);
    const [savedScenes, setSavedScenes] = useState<SceneType[]>([]);
    const [operationStatus, setOperationStatus] = useState<{
        type: 'success' | 'error' | 'info';
        message: string;
    } | null>(null);
    const [isViewerMode] = useState(false);
    const [showMapList, setShowMapList] = useState(false);
    const [showInitiative, setShowInitiative] = useState(true);
    const [isSceneManagementOpen, setIsSceneManagementOpen] = useState(false);
    const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);
    const [isCleanLayout, setIsCleanLayout] = useState(false);

    useEffect(() => {
        websocketService.connect();

        const unsubscribe = websocketService.addListener((data) => {
            console.log('Received data:', data);
            if (data.type === 'scene_update' && data.scene) {
                setScene({
                    ...data.scene,
                    gridSettings: data.scene.gridSettings || {
                        showGrid: true,
                        gridSize: 50
                    }
                });
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

    const handleMapSelect = async (mapName: string | null) => {
        console.log("Map selected:", mapName);

        if (!mapName) {
            // Just clear the selection
            const updatedScene = {
                ...scene,
                activeMapId: null
            };
            setScene(updatedScene);
            websocketService.send({
                type: 'scene_update',
                scene: updatedScene
            });
            return;
        }

        // Check if the map already exists in the scene
        const mapExists = scene.maps.some(m => m.name === mapName);
        console.log("Map exists in scene:", mapExists);

        if (mapExists) {
            // If it exists, just select it
            const updatedScene = {
                ...scene,
                activeMapId: mapName
            };
            setScene(updatedScene);
            websocketService.send({
                type: 'scene_update',
                scene: updatedScene
            });
            console.log("Selected existing map:", mapName);
        } else {
            // If not, fetch the map data and add it to the scene
            try {
                console.log("Fetching data for new map:", mapName);

                // First fetch all map details including folder structure
                const listResponse = await fetch('http://localhost:8010/maps/list');
                if (!listResponse.ok) throw new Error('Failed to fetch map list');

                const listData = await listResponse.json();
                console.log("All available maps:", listData.maps);

                const mapInfo = listData.maps.find((m: { name: string, folder?: string }) => m.name === mapName);
                console.log("Found map info:", mapInfo);

                if (!mapInfo) throw new Error(`Map ${mapName} not found`);

                // Create a new map object
                const newMap: MapData = {
                    name: mapName,
                    folder: mapInfo.folder,
                    data: {
                        position: { x: 100, y: 100 },
                        scale: 1,
                        rotation: 0,
                        isHidden: false
                    }
                };

                console.log("Adding new map to scene:", newMap);

                // Add it to the scene
                const updatedScene = {
                    ...scene,
                    maps: [...scene.maps, newMap],
                    activeMapId: mapName
                };

                setScene(updatedScene);
                websocketService.send({
                    type: 'scene_update',
                    scene: updatedScene
                });

                toast({
                    title: "Map Added",
                    description: `Map "${mapName}" added to scene`,
                    duration: 3000,
                });
            } catch (error) {
                console.error('Error adding map to scene:', error);
                toast({
                    title: "Error",
                    description: "Failed to add map to scene. Please try again.",
                    variant: "destructive",
                    duration: 3000,
                });
            }
        }
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
                    isHidden: true
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
            toast({
                title: "Error",
                description: "Failed to upload map. Please try again.",
                variant: "destructive",
                duration: 3000,
            });
        }
    };

    const handleSaveScene = async (name: string, isSaveAs: boolean = false) => {
        try {
            const timestamp = new Date().toLocaleString();
            const sceneToSave = {
                ...scene,
                name: isSaveAs ? `${name} (${timestamp})` : scene.name,
                id: isSaveAs ? Date.now().toString() : scene.id,
                gridSettings: scene.gridSettings || {
                    showGrid: true,
                    gridSize: 50
                },
                initiativeOrder: scene.initiativeOrder || [],
                showCurrentPlayer: scene.showCurrentPlayer ?? true
            };

            const endpoint = isSaveAs ? 'http://localhost:8010/scenes/save' : `http://localhost:8010/scenes/${scene.id}`;
            const method = isSaveAs ? 'POST' : 'PUT';

            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sceneToSave),
            });

            if (!response.ok) {
                throw new Error('Failed to save scene');
            }

            setScene(sceneToSave);
            toast({
                title: "Scene Saved",
                description: `Scene "${sceneToSave.name}" ${isSaveAs ? 'saved' : 'updated'} at ${timestamp}`,
                duration: 3000,
            });
            setIsSaveSceneOpen(false);
        } catch (error) {
            console.error('Error saving scene:', error);
            toast({
                title: "Error",
                description: "Failed to save scene. Please try again.",
                variant: "destructive",
                duration: 3000,
            });
        }
    };

    const handleLoadScene = async () => {
        try {
            const response = await fetch('http://localhost:8010/scenes/list', {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to load scenes');
            }

            const scenes = await response.json();
            const scenesWithDefaults = scenes.map((scene: Partial<SceneType>) => ({
                ...scene,
                gridSettings: scene.gridSettings || {
                    showGrid: true,
                    gridSize: 50
                },
                initiativeOrder: scene.initiativeOrder || [],
                showCurrentPlayer: scene.showCurrentPlayer ?? true
            }));
            setSavedScenes(scenesWithDefaults);
            setIsLoadSceneOpen(true);
        } catch (error) {
            console.error('Error loading scenes:', error);
            toast({
                title: "Error",
                description: "Failed to load scenes. Please try again.",
                variant: "destructive",
                duration: 3000,
            });
        }
    };

    const handleSceneLoad = async (loadedScene: SceneType) => {
        try {
            const response = await fetch(`http://localhost:8010/scenes/load/${loadedScene.id}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to load scene');
            }

            const sceneData = await response.json();
            const sceneWithDefaults = {
                ...sceneData,
                gridSettings: sceneData.gridSettings || {
                    showGrid: true,
                    gridSize: 50
                },
                initiativeOrder: sceneData.initiativeOrder || [],
                showCurrentPlayer: sceneData.showCurrentPlayer ?? true
            };
            setScene(sceneWithDefaults);
            websocketService.send({
                type: 'scene_update',
                scene: sceneWithDefaults
            });
            toast({
                title: "Scene Loaded",
                description: "Scene loaded successfully",
                duration: 3000,
            });
            setIsLoadSceneOpen(false);
        } catch (error) {
            console.error('Error loading scene:', error);
            toast({
                title: "Error",
                description: "Failed to load scene. Please try again.",
                variant: "destructive",
                duration: 3000,
            });
        }
    };

    const handleGridToggle = () => {
        const updatedScene = {
            ...scene,
            gridSettings: {
                ...scene.gridSettings,
                showGrid: !scene.gridSettings.showGrid
            }
        };
        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
    };

    const handleMapVisibilityToggle = (mapName: string) => {
        const updatedScene = {
            ...scene,
            maps: scene.maps.map(m =>
                m.name === mapName
                    ? { ...m, data: { ...m.data, isHidden: !m.data.isHidden } }
                    : m
            )
        };
        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
    };

    const handleMapsReorder = (newMaps: MapData[]) => {
        const updatedScene = {
            ...scene,
            maps: newMaps
        };
        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
    };

    const handleDeleteMap = (mapName: string) => {
        const updatedScene = {
            ...scene,
            maps: scene.maps.filter(m => m.name !== mapName),
            activeMapId: scene.activeMapId === mapName ? null : scene.activeMapId
        };
        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
    };

    const handleInitiativeUpdate = (entries: InitiativeEntry[]) => {
        const updatedScene = {
            ...scene,
            initiativeOrder: entries
        };
        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
    };

    const handleToggleCurrentPlayer = () => {
        const updatedScene = {
            ...scene,
            showCurrentPlayer: !scene.showCurrentPlayer
        };
        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
    };

    const handleMapRefresh = async () => {
        try {
            // Fetch all available maps
            const response = await fetch('http://localhost:8010/maps/list');
            if (!response.ok) throw new Error('Failed to load maps');

            const data = await response.json();
            const availableMaps = data.maps || [];

            // Only update existing maps with folder information, don't add new ones
            const updatedMaps = scene.maps.map(currentMap => {
                const matchingMap = availableMaps.find((m: { name: string, folder?: string }) =>
                    m.name === currentMap.name
                );

                if (matchingMap) {
                    return {
                        ...currentMap,
                        folder: matchingMap.folder
                    };
                }
                return currentMap;
            });

            // Remove maps that no longer exist on the backend
            const finalMaps = updatedMaps.filter(map =>
                availableMaps.some((m: { name: string }) => m.name === map.name)
            );

            const updatedScene = {
                ...scene,
                maps: finalMaps
            };

            setScene(updatedScene);
            websocketService.send({
                type: 'scene_update',
                scene: updatedScene
            });

            toast({
                title: "Maps Refreshed",
                description: "Map list has been updated",
                duration: 3000,
            });
        } catch (error) {
            console.error('Error refreshing maps:', error);
            toast({
                title: "Error",
                description: "Failed to refresh maps. Please try again.",
                variant: "destructive",
                duration: 3000,
            });
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
                {/* Maps Container */}
                <div className="absolute inset-0">
                    {scene.maps.map((map, index) => (
                        <Map
                            key={map.name}
                            map={map}
                            isActive={map.name === scene.activeMapId}
                            onUpdate={handleMapUpdate}
                            isViewerMode={isViewerMode}
                            zIndex={index}
                        />
                    ))}
                </div>

                {/* Grid Overlay - Always on top */}
                {scene.gridSettings.showGrid && (
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: `
                                linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
                            `,
                            backgroundSize: `${scene.gridSettings.gridSize}px ${scene.gridSettings.gridSize}px`,
                            opacity: 0.5,
                            zIndex: 999
                        }}
                    />
                )}
            </div>

            {/* Map List Sidebar */}
            {!isViewerMode && showMapList && (
                <MapListSidebar
                    scene={scene}
                    onMapSelect={handleMapSelect}
                    onMapVisibilityToggle={handleMapVisibilityToggle}
                    onMapAdd={() => setIsUploadOpen(true)}
                    onMapsReorder={handleMapsReorder}
                    onMapDelete={handleDeleteMap}
                    onClose={() => setShowMapList(false)}
                    onMapRefresh={handleMapRefresh}
                />
            )}

            {/* Show Map List Button - Only show when hidden and not in clean layout */}
            {!isViewerMode && !showMapList && !isCleanLayout && (
                <div className="absolute top-4 right-4 z-50">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-zinc-900/80 backdrop-blur-sm"
                        onClick={() => setShowMapList(true)}
                    >
                        <LayoutGrid className="h-4 w-4" />
                        Show Maps
                    </Button>
                </div>
            )}

            {/* Connection Status Indicator - Only show in normal layout */}
            {!isCleanLayout && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900/80 backdrop-blur-sm border border-zinc-800">
                        {connectionStatus === 'connected' ? (
                            <>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs text-emerald-500">Connected</span>
                            </>
                        ) : (
                            <>
                                <div className="h-2 w-2 rounded-full bg-zinc-600" />
                                <span className="text-xs text-zinc-600 capitalize">{connectionStatus}</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Current Player Indicator - Only show in viewer mode */}
            {!isAdmin && (
                <InitiativeIndicator
                    initiativeOrder={scene.initiativeOrder}
                    showCurrentPlayer={scene.showCurrentPlayer}
                />
            )}

            {/* Initiative Sidebar */}
            {showInitiative && (
                <InitiativeSidebar
                    isAdmin={isAdmin}
                    entries={scene.initiativeOrder}
                    onUpdate={handleInitiativeUpdate}
                    showCurrentPlayer={scene.showCurrentPlayer}
                    onToggleCurrentPlayer={handleToggleCurrentPlayer}
                    onClose={() => setShowInitiative(false)}
                />
            )}

            {/* Show Initiative Button - Only show when hidden and not in clean layout */}
            {!showInitiative && !isCleanLayout && (
                <div className="absolute left-4 bottom-4 z-50">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-zinc-900/80 backdrop-blur-sm"
                        onClick={() => setShowInitiative(true)}
                    >
                        <Users className="h-4 w-4" />
                        Show Initiative
                    </Button>
                </div>
            )}

            {/* Floating Menu Button - Only show in non-viewer mode */}
            {!isViewerMode && (
                <div className="absolute top-4 left-4 z-50">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className={cn(
                                "gap-2 bg-zinc-900/80 backdrop-blur-sm",
                                isCleanLayout && "h-6 w-6 p-0"
                            )}>
                                <LayoutGrid className="h-4 w-4" />
                                {!isCleanLayout && <span>Menu</span>}
                                {!isCleanLayout && <ChevronDown className="h-4 w-4" />}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 bg-zinc-900/95 backdrop-blur-sm border-zinc-800">
                            {/* Connection Status */}
                            <div className="px-2 py-1">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Wifi className="h-4 w-4 text-zinc-400" />
                                    <span className="text-xs font-medium text-zinc-300">Connection</span>
                                </div>
                                <div className="mt-2">
                                    <div className="flex items-center gap-2">
                                        {connectionStatus === 'connected' ? (
                                            <>
                                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                <span className="text-xs text-emerald-500">Connected</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="h-2 w-2 rounded-full bg-zinc-600" />
                                                <span className="text-xs text-zinc-600 capitalize">{connectionStatus}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <DropdownMenuSeparator className="bg-zinc-800" />

                            {/* Layout Toggle */}
                            <DropdownMenuItem
                                onClick={() => setIsCleanLayout(!isCleanLayout)}
                                className="flex items-center gap-2"
                            >
                                <LayoutGrid className="h-4 w-4" />
                                {isCleanLayout ? 'Show Full Menu' : 'Clean Layout'}
                            </DropdownMenuItem>

                            {/* Map List Toggle */}
                            <DropdownMenuItem
                                onClick={() => setShowMapList(!showMapList)}
                                className="flex items-center gap-2"
                            >
                                <LayoutGrid className="h-4 w-4" />
                                {showMapList ? 'Hide Map List' : 'Show Map List'}
                            </DropdownMenuItem>

                            {/* Initiative Toggle */}
                            <DropdownMenuItem
                                onClick={() => setShowInitiative(!showInitiative)}
                                className="flex items-center gap-2"
                            >
                                <Users className="h-4 w-4" />
                                {showInitiative ? 'Hide Initiative' : 'Show Initiative'}
                            </DropdownMenuItem>

                            {/* Soundboard Toggle */}
                            <DropdownMenuItem
                                onClick={() => setIsSoundboardOpen(!isSoundboardOpen)}
                                className="flex items-center gap-2"
                            >
                                <Music className="h-4 w-4" />
                                {isSoundboardOpen ? 'Hide Soundboard' : 'Show Soundboard'}
                            </DropdownMenuItem>

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
                                        onClick={() => handleSaveScene(scene.name, false)}
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        Save
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-xs cursor-pointer"
                                        onClick={() => setIsSaveSceneOpen(true)}
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        Save As...
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-xs cursor-pointer"
                                        onClick={() => setIsSceneManagementOpen(true)}
                                    >
                                        <FolderOpen className="h-4 w-4 mr-2" />
                                        Manage Scenes
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
                                <DropdownMenuItem
                                    className="text-xs cursor-pointer"
                                    onClick={() => window.open('/viewer', '_blank')}
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Open Viewer Page
                                </DropdownMenuItem>
                            </div>

                            <DropdownMenuSeparator className="bg-zinc-800" />

                            {/* Grid Settings */}
                            <div className="px-2 py-1">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Grid className="h-4 w-4 text-zinc-400" />
                                    <span className="text-xs font-medium text-zinc-300">Grid</span>
                                </div>
                                <div className="space-y-1 mt-1">
                                    <DropdownMenuItem
                                        className="text-xs cursor-pointer"
                                        onClick={handleGridToggle}
                                    >
                                        {scene.gridSettings.showGrid ? (
                                            <Eye className="h-4 w-4 mr-2" />
                                        ) : (
                                            <EyeOff className="h-4 w-4 mr-2" />
                                        )}
                                        {scene.gridSettings.showGrid ? 'Hide Grid' : 'Show Grid'}
                                    </DropdownMenuItem>
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            <UploadDialog
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onUpload={handleUpload}
            />

            <SaveSceneDialog
                isOpen={isSaveSceneOpen}
                onClose={() => setIsSaveSceneOpen(false)}
                onSave={handleSaveScene}
                currentName={scene.name}
            />

            <LoadSceneDialog
                isOpen={isLoadSceneOpen}
                onClose={() => setIsLoadSceneOpen(false)}
                onLoad={handleSceneLoad}
                savedScenes={savedScenes}
            />

            <SceneOperationStatusDialog
                isOpen={operationStatus !== null}
                onClose={() => setOperationStatus(null)}
                type={operationStatus?.type || 'info'}
                message={operationStatus?.message || ''}
            />

            {/* Scene Management Dialog */}
            <SceneManagement
                isOpen={isSceneManagementOpen}
                onClose={() => setIsSceneManagementOpen(false)}
                onLoad={handleSceneLoad}
                currentScene={scene}
            />

            {/* Soundboard Toggle Button - Only show when not in clean layout */}
            {!isViewerMode && !isCleanLayout && (
                <div className="absolute bottom-4 right-4 z-50">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-zinc-900/80 backdrop-blur-sm"
                        onClick={() => setIsSoundboardOpen(!isSoundboardOpen)}
                    >
                        <Music className="h-4 w-4" />
                        {isSoundboardOpen ? 'Hide Soundboard' : 'Show Soundboard'}
                    </Button>
                </div>
            )}

            {/* Soundboard Component */}
            <Soundboard
                isOpen={isSoundboardOpen}
                onClose={() => setIsSoundboardOpen(false)}
            />
        </div>
    );
}; 