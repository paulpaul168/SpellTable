"use client"

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
    ExternalLink,
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

interface SceneProps {
    initialScene: SceneType;
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

export const Scene: React.FC<SceneProps> = ({ initialScene }) => {
    const [scene, setScene] = useState<SceneType>(initialScene);
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
    const [isMapHidden] = useState(false);

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
        const updatedScene = {
            ...scene,
            activeMapId: mapName
        };
        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
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
                    showGrid: true,
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
        }
    };

    const handleSaveScene = async (name: string) => {
        try {
            const sceneToSave = {
                ...scene,
                name,
                id: scene.id || Date.now().toString(),
            };

            const response = await fetch('http://localhost:8010/scenes/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sceneToSave),
            });

            if (!response.ok) {
                throw new Error('Failed to save scene');
            }

            setScene(sceneToSave);
            setOperationStatus({
                type: 'success',
                message: 'Scene saved successfully',
            });
        } catch (error) {
            console.error('Error saving scene:', error);
            setOperationStatus({
                type: 'error',
                message: 'Failed to save scene. Please try again.',
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
            setSavedScenes(scenes);
            setIsLoadSceneOpen(true);
        } catch (error) {
            console.error('Error loading scenes:', error);
            setOperationStatus({
                type: 'error',
                message: 'Failed to load scenes. Please try again.',
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
            setScene(sceneData);
            websocketService.send({
                type: 'scene_update',
                scene: sceneData
            });
            setOperationStatus({
                type: 'success',
                message: 'Scene loaded successfully',
            });
        } catch (error) {
            console.error('Error loading scene:', error);
            setOperationStatus({
                type: 'error',
                message: 'Failed to load scene. Please try again.',
            });
        }
    };

    const handleGridToggle = () => {
        if (!scene.activeMapId) return;

        const updatedScene = {
            ...scene,
            maps: scene.maps.map(m =>
                m.name === scene.activeMapId
                    ? { ...m, data: { ...m.data, showGrid: !m.data.showGrid } }
                    : m
            )
        };

        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
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
                        isViewerMode={isViewerMode}
                    />
                ))}
            </div>

            {/* Grid Overlay */}
            {!isMapHidden && scene.maps.find(m => m.name === scene.activeMapId)?.data.showGrid && (
                <div
                    className="fixed inset-0 pointer-events-none"
                    style={{
                        backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px),
                                        linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)`,
                        backgroundSize: `${scene.maps.find(m => m.name === scene.activeMapId)?.data.gridSize || 50}px ${scene.maps.find(m => m.name === scene.activeMapId)?.data.gridSize || 50}px`,
                        zIndex: 10
                    }}
                />
            )}

            {/* Floating Menu Button - Only show in non-viewer mode */}
            {!isViewerMode && (
                <div className="absolute top-4 left-4" style={{ zIndex: 9999 }}>
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
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center">
                                                    <ImageIcon className="h-4 w-4 mr-2" />
                                                    {map.name}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const updatedScene = {
                                                            ...scene,
                                                            maps: scene.maps.map(m =>
                                                                m.name === map.name
                                                                    ? { ...m, data: { ...m.data, isHidden: !m.data.isHidden } }
                                                                    : m
                                                            )
                                                        };
                                                        setScene(updatedScene);
                                                        websocketService.send({
                                                            type: 'scene_update',
                                                            scene: updatedScene
                                                        });
                                                    }}
                                                >
                                                    {map.data.isHidden ? (
                                                        <EyeOff className="h-4 w-4 text-zinc-400" />
                                                    ) : (
                                                        <Eye className="h-4 w-4 text-zinc-400" />
                                                    )}
                                                </Button>
                                            </div>
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
                                        onClick={() => setIsSaveSceneOpen(true)}
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
                                        {scene.maps.find(m => m.name === scene.activeMapId)?.data.showGrid ? (
                                            <Eye className="h-4 w-4 mr-2" />
                                        ) : (
                                            <EyeOff className="h-4 w-4 mr-2" />
                                        )}
                                        {scene.maps.find(m => m.name === scene.activeMapId)?.data.showGrid ? 'Hide Grid' : 'Show Grid'}
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
        </div >
    );
}; 