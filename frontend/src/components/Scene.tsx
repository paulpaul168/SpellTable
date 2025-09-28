"use client"

import React, { useState, useEffect } from 'react';
import { Scene as SceneType, MapData, AoEMarker as AoEMarkerType, FogOfWar as FogOfWarType } from '../types/map';
import { Map } from './Map';
import { websocketService } from '@/services/websocket';
import { UploadDialog } from './UploadDialog';
import { Button } from '@/components/ui/button';
import {
    LayoutGrid,
    Users,
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
    Music,
    Zap,
    Database,
    Move,
    RotateCw,
    UserPlus,
    Shield,
    BookOpen, Skull
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SaveSceneDialog } from './SaveSceneDialog';
import { LoadSceneDialog } from './LoadSceneDialog';
import { MapListSidebar } from './MapListSidebar';
import { useToast } from "@/components/ui/use-toast";
import { InitiativeSidebar } from './InitiativeSidebar';
import { InitiativeEntry } from '@/types/map';
import { SceneManagement } from './SceneManagement';
import { Soundboard } from './Soundboard';
import { cn } from '@/lib/utils';
import { InitiativeIndicator } from './InitiativeIndicator';
import { AoEMarker } from './AoEMarker';
import { AoEPalette } from './AoEPalette';
import { FogOfWar } from './FogOfWar';
import { FogOfWarPalette } from './FogOfWarPalette';
import { DisplayCalculator } from './DisplayCalculator';
import { BackupDialog } from './BackupDialog';
import { GameboardMenu } from './GameboardMenu';
import { MoveEverythingDialog } from './MoveEverythingDialog';
import { UserManagementDialog } from './UserManagementDialog';
import { useAuth } from '@/contexts/AuthContext';
import {getApiUrl} from "@/utils/api";
import {MonsterManagementDialog} from "@/components/MonsterManagementDialog";

interface SceneProps {
    initialScene?: SceneType;
    isAdmin?: boolean;
    initialDisplayScale?: number;
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

export const Scene: React.FC<SceneProps> = ({ initialScene, isAdmin = false, initialDisplayScale = 1.0 }) => {
    const { toast } = useToast();
    const { user, logout, isAdmin: isUserAdmin } = useAuth();
    const [scene, setScene] = useState<SceneType>({
        id: initialScene?.id || 'default',
        name: initialScene?.name || 'Default Scene',
        maps: initialScene?.maps || [],
        activeMapId: initialScene?.activeMapId || null,
        gridSettings: initialScene?.gridSettings || {
            showGrid: true,
            gridSize: 50,
            useFixedGrid: true,
            gridCellsX: 18,
            gridCellsY: 32
        },
        initiativeOrder: initialScene?.initiativeOrder || [],
        showCurrentPlayer: true,
        aoeMarkers: initialScene?.aoeMarkers || [],
        fogOfWar: initialScene?.fogOfWar || [],
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
    const [isAoEPaletteOpen, setIsAoEPaletteOpen] = useState(false);
    const [isFogOfWarPaletteOpen, setIsFogOfWarPaletteOpen] = useState(false);
    const [isDisplayCalculatorOpen, setIsDisplayCalculatorOpen] = useState(false);
    const [isGridSettingsOpen, setIsGridSettingsOpen] = useState(false);
    const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
    const [hideInvisibleMaps, setHideInvisibleMaps] = useState(false);
    const [highlightedMarkerId, setHighlightedMarkerId] = useState<string | null>(null);
    const [highlightedFogOfWarId, setHighlightedFogOfWarId] = useState<string | null>(null);
    const [isMoveEverythingOpen, setIsMoveEverythingOpen] = useState(false);
    const [isViewerBlanked, setIsViewerBlanked] = useState(false);
    const [isViewerRotated, setIsViewerRotated] = useState(false);
    const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
    const [isMonsterManagementOpen, setIsMonsterManagementOpen] = useState(false);

    // Remove display scale functionality, using fixed 1.0 scale
    const displayScale = 1.0;

    useEffect(() => {
        websocketService.connect();

        const unsubscribe = websocketService.addListener((data) => {
            console.log('Received data:', data);
            if (data.type === 'scene_update' && data.scene) {
                // Check if this is an external update that might overwrite our local changes
                const incomingScene = data.scene;

                // If we just renamed a map, we need to be careful not to lose that update
                // Compare activeMapId to see if it's reverting to an old name
                if (scene.activeMapId && scene.activeMapId !== incomingScene.activeMapId) {
                    const oldMapName = incomingScene.activeMapId;
                    const currentMapName = scene.activeMapId;

                    console.log(`Detected potential map reference mismatch: 
                        Current activeMapId: ${currentMapName} 
                        Incoming activeMapId: ${oldMapName}`);

                    // Check if the current map exists in the incoming scene
                    const hasCurrentMapInIncoming = incomingScene.maps.some(m => m.name === currentMapName);

                    if (!hasCurrentMapInIncoming) {
                        console.log(`Warning: Incoming scene update does not contain our active map "${currentMapName}"`);

                        // Try to find a map that was renamed
                        const potentialRenamedMap = scene.maps.find(m =>
                            !incomingScene.maps.some(im => im.name === m.name) && m.name === currentMapName);

                        if (potentialRenamedMap) {
                            console.log(`Detected local map rename that's not reflected in incoming data. 
                                Preserving local state to avoid losing rename.`);
                            return; // Skip this update to avoid losing our rename
                        }
                    }
                }

                setScene({
                    ...data.scene,
                    gridSettings: data.scene.gridSettings || {
                        showGrid: true,
                        gridSize: 50
                    },
                    aoeMarkers: data.scene.aoeMarkers || [],
                    fogOfWar: data.scene.fogOfWar || []
                });
            } else if (data.type === 'connection_status') {
                setConnectionStatus(data.status || 'unknown');
            } else if (data.type === 'ripple_viewer_ready') {
                // Log that a viewer is ready to receive ripple events
                console.log('Viewer is ready to receive ripple effects');
                toast({
                    title: "Viewer Connected",
                    description: "A viewer is ready to receive ripple effects",
                    duration: 3000,
                });
            } else if (data.type === 'viewer_blank_status') {
                // Update blank status from server (if we need server-side state sync)
                setIsViewerBlanked(data.isBlank === true);
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
                const API_BASE_URL = getApiUrl();
                const listResponse = await fetch(`${API_BASE_URL}/maps/list`);
                if (!listResponse.ok) throw new Error('Failed to fetch map list');

                const listData = await listResponse.json();
                console.log("All available maps:", listData.maps);

                const mapInfo = listData.maps.find((m: { name: string, folder?: string }) => m.name === mapName);
                console.log("Found map info:", mapInfo);

                if (!mapInfo) throw new Error(`Map ${mapName} not found`);

                // Determine grid dimensions and calculate center cell
                const gridCellsX = scene.gridSettings.gridCellsX || 32;
                const gridCellsY = scene.gridSettings.gridCellsY || 18;

                // Calculate center position in grid cells
                // The gridCoordsToPixel function will add the 0.5 offset to center in cells
                const centerGridX = Math.floor(gridCellsX / 2);
                const centerGridY = Math.floor(gridCellsY / 2);

                const newMap: MapData = {
                    name: mapName,
                    folder: mapInfo.folder,
                    data: {
                        position: { x: centerGridX, y: centerGridY },
                        useGridCoordinates: true,
                        useGridScaling: true, // Enable grid scaling for new maps
                        scale: 1,
                        rotation: 0,
                        isHidden: false
                    }
                };

                console.log("Adding new map to scene with grid coordinates:", newMap);

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
            const API_BASE_URL = getApiUrl();
            const response = await fetch(`${API_BASE_URL}/maps/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();

            // Determine grid dimensions and calculate center cell
            const gridCellsX = scene.gridSettings.gridCellsX || 18;
            const gridCellsY = scene.gridSettings.gridCellsY || 32;

            // Calculate center position in grid cells
            // The gridCoordsToPixel function will add the 0.5 offset to center in cells
            const centerGridX = Math.floor(gridCellsX / 2);
            const centerGridY = Math.floor(gridCellsY / 2);

            const newMap: MapData = {
                name: data.filename,
                data: {
                    position: { x: centerGridX, y: centerGridY },
                    useGridCoordinates: true,
                    useGridScaling: true, // Enable grid scaling for new maps
                    scale: 1,
                    rotation: 0,
                    isHidden: false
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
                showCurrentPlayer: scene.showCurrentPlayer ?? true,
                aoeMarkers: scene.aoeMarkers || [],
                fogOfWar: scene.fogOfWar || []
            };

            const API_BASE_URL = getApiUrl();
            const endpoint = isSaveAs ? `${API_BASE_URL}/scenes/save` : `${API_BASE_URL}/scenes/${scene.id}`;
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
            const API_BASE_URL = getApiUrl();
            const response = await fetch(`${API_BASE_URL}/scenes/list`, {
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
                showCurrentPlayer: scene.showCurrentPlayer ?? true,
                aoeMarkers: scene.aoeMarkers || [],
                fogOfWar: scene.fogOfWar || []
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
            const API_BASE_URL = getApiUrl();
            const response = await fetch(`${API_BASE_URL}/scenes/load/${loadedScene.id}`, {
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
                showCurrentPlayer: sceneData.showCurrentPlayer ?? true,
                aoeMarkers: sceneData.aoeMarkers || [],
                fogOfWar: sceneData.fogOfWar || []
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

    const handleUpdateGridSettings = (newGridSettings: any) => {
        // Check if useFixedGrid is being enabled
        const isEnablingFixedGrid = !scene.gridSettings.useFixedGrid && newGridSettings.useFixedGrid;
        // Check if grid size is being changed
        const isChangingGridSize = scene.gridSettings.gridSize !== newGridSettings.gridSize;

        // If enabling fixed grid, convert all positions to grid coordinates
        if (isEnablingFixedGrid) {
            // Calculate pixel-to-grid conversion factors
            const gridCellsX = newGridSettings.gridCellsX || scene.gridSettings.gridCellsX || 25;
            const gridCellsY = newGridSettings.gridCellsY || scene.gridSettings.gridCellsY || 13;
            const cellWidth = window.innerWidth / gridCellsX;
            const cellHeight = window.innerHeight / gridCellsY;

            // Convert all maps to use grid coordinates
            const updatedMaps = scene.maps.map(map => {
                // Only convert maps not already using grid coordinates
                if (!map.data.useGridCoordinates) {
                    const pixelPos = map.data.position;
                    const gridPos = {
                        x: pixelPos.x / cellWidth,
                        y: pixelPos.y / cellHeight
                    };

                    return {
                        ...map,
                        data: {
                            ...map.data,
                            position: gridPos,
                            useGridCoordinates: true,
                            useGridScaling: true // Enable grid scaling for better consistency
                        }
                    };
                }
                // Enable grid scaling for all maps when switching to fixed grid
                return {
                    ...map,
                    data: {
                        ...map.data,
                        useGridScaling: true
                    }
                };
            });

            // Convert all AoE markers to use grid coordinates
            const updatedMarkers = scene.aoeMarkers ? scene.aoeMarkers.map(marker => {
                // Only convert markers not already using grid coordinates
                if (!marker.useGridCoordinates) {
                    const pixelPos = marker.position;
                    const gridPos = {
                        x: pixelPos.x / cellWidth,
                        y: pixelPos.y / cellHeight
                    };

                    return {
                        ...marker,
                        position: gridPos,
                        useGridCoordinates: true
                    };
                }
                return marker;
            }) : [];

            // Update the scene with converted coordinates and new grid settings
            const updatedScene = {
                ...scene,
                gridSettings: {
                    ...scene.gridSettings,
                    ...newGridSettings
                },
                maps: updatedMaps,
                aoeMarkers: updatedMarkers
            };

            setScene(updatedScene);
            websocketService.send({
                type: 'scene_update',
                scene: updatedScene
            });

            toast({
                title: "Grid System Updated",
                description: "All objects converted to grid coordinates for consistent scaling",
                duration: 3000,
            });
        }
        // If just changing grid size, ensure maps use grid scaling
        else if (isChangingGridSize) {
            // Enable grid scaling for all maps when changing grid size
            const updatedMaps = scene.maps.map(map => ({
                ...map,
                data: {
                    ...map.data,
                    useGridScaling: true // Enable grid scaling for better consistency
                }
            }));

            // Update scene with the new grid settings and map scaling
            const updatedScene = {
                ...scene,
                gridSettings: {
                    ...scene.gridSettings,
                    ...newGridSettings
                },
                maps: updatedMaps
            };

            setScene(updatedScene);
            websocketService.send({
                type: 'scene_update',
                scene: updatedScene
            });

            toast({
                title: "Grid Size Updated",
                description: "Maps will scale with the grid for consistency",
                duration: 3000,
            });
        }
        else {
            // Just update grid settings without conversion
            const updatedScene = {
                ...scene,
                gridSettings: {
                    ...scene.gridSettings,
                    ...newGridSettings
                }
            };
            setScene(updatedScene);
            websocketService.send({
                type: 'scene_update',
                scene: updatedScene
            });
        }
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
            const API_BASE_URL = getApiUrl();
            const response = await fetch(`${API_BASE_URL}/maps/list`);
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

    // Add a new function to handle map renaming and reference updates
    const handleMapRename = async (oldName: string, newName: string) => {
        console.log(`Handling map rename from "${oldName}" to "${newName}" in scene component`);

        // Check if the map exists in the current scene
        if (scene.maps.some(m => m.name === oldName)) {
            console.log(`Updating references from "${oldName}" to "${newName}" in current scene`);

            try {
                // Update maps array
                const updatedMaps = scene.maps.map(map => {
                    if (map.name === oldName) {
                        console.log(`Found map to rename: ${map.name}`);
                        return {
                            ...map,
                            name: newName
                        };
                    }
                    return map;
                });

                // Update activeMapId if necessary
                const updatedActiveMapId = scene.activeMapId === oldName
                    ? newName
                    : scene.activeMapId;

                console.log(`Updated maps:`, updatedMaps);
                console.log(`Updated activeMapId: ${updatedActiveMapId}`);

                // Create updated scene with a unique timestamp to ensure it's seen as a new update
                const updatedScene = {
                    ...scene,
                    maps: updatedMaps,
                    activeMapId: updatedActiveMapId,
                    _lastUpdated: Date.now() // Add timestamp to force update
                };

                // Update scene state and broadcast changes
                setScene(updatedScene);

                // Wait before sending websocket update to ensure state is updated
                await new Promise(resolve => setTimeout(resolve, 50));

                // Send websocket update
                websocketService.send({
                    type: 'scene_update',
                    scene: updatedScene
                });

                // Mark this scene as having a pending rename operation
                const pendingRename = { oldName, newName, timestamp: Date.now() };
                console.log(`Setting pending rename operation:`, pendingRename);

                // Add a safety delay to prevent race conditions with other components
                setTimeout(() => {
                    // Check if the scene still has the updated map
                    const currentMaps = scene.maps || [];
                    const hasUpdatedMap = currentMaps.some(m => m.name === newName);
                    const stillHasOldMap = currentMaps.some(m => m.name === oldName);

                    if (!hasUpdatedMap && stillHasOldMap) {
                        console.log("Re-applying map rename - scene has reverted to old state");
                        // If scene reverted, apply the update again
                        setScene(updatedScene);
                        websocketService.send({
                            type: 'scene_update',
                            scene: updatedScene
                        });
                    }
                }, 500);

                toast({
                    title: "Map References Updated",
                    description: `Updated references to map "${newName}" in the current scene`,
                    duration: 3000,
                });
            } catch (error) {
                console.error("Error updating map references:", error);
                toast({
                    title: "Error",
                    description: "Failed to update map references in the current scene",
                    variant: "destructive",
                    duration: 3000,
                });
            }
        } else {
            console.log(`Map "${oldName}" not found in current scene - no updates needed`);
        }
    };

    // Handler for adding a new AoE marker
    const handleAddAoEMarker = (markerData: Omit<AoEMarkerType, 'id' | 'position'>) => {
        // Determine grid dimensions and calculate center cell
        const gridCellsX = scene.gridSettings.gridCellsX || 18;
        const gridCellsY = scene.gridSettings.gridCellsY || 32;

        // Calculate center position in grid cells
        // The gridCoordsToPixel function will add the 0.5 offset to center in cells
        const centerGridX = Math.floor(gridCellsX / 2);
        const centerGridY = Math.floor(gridCellsY / 2);

        const newMarker: AoEMarkerType = {
            ...markerData,
            id: Date.now().toString(),
            position: {
                x: centerGridX,
                y: centerGridY
            },
            useGridCoordinates: true
        };

        const updatedScene = {
            ...scene,
            aoeMarkers: [...(scene.aoeMarkers || []), newMarker]
        };

        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });

        toast({
            title: "Marker Added",
            description: `Added ${markerData.shape} marker`,
            duration: 3000,
        });
    };

    // Handler for updating an AoE marker
    const handleUpdateAoEMarker = (updatedMarker: AoEMarkerType) => {
        if (!scene.aoeMarkers) return;

        const updatedMarkers = scene.aoeMarkers.map(marker =>
            marker.id === updatedMarker.id ? updatedMarker : marker
        );

        const updatedScene = {
            ...scene,
            aoeMarkers: updatedMarkers
        };

        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
    };

    // Handler for deleting an AoE marker
    const handleDeleteAoEMarker = (markerId: string) => {
        if (!scene.aoeMarkers) return;

        const updatedMarkers = scene.aoeMarkers.filter(marker => marker.id !== markerId);

        const updatedScene = {
            ...scene,
            aoeMarkers: updatedMarkers
        };

        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });

        toast({
            title: "Marker Deleted",
            description: "AoE marker removed",
            duration: 3000,
        });
    };

    // Handler for adding a new fog of war
    const handleAddFogOfWar = (fogOfWarData: Omit<FogOfWarType, 'id'>) => {
        const newFogOfWar: FogOfWarType = {
            ...fogOfWarData,
            id: Date.now().toString()
        };

        const updatedScene = {
            ...scene,
            fogOfWar: [...(scene.fogOfWar || []), newFogOfWar]
        };

        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });

        toast({
            title: "Fog of War Added",
            description: "New fog area created",
            duration: 3000,
        });
    };

    // Handler for updating fog of war
    const handleUpdateFogOfWar = (updatedFogOfWar: FogOfWarType) => {
        if (!scene.fogOfWar) return;

        const updatedFogOfWarList = scene.fogOfWar.map(fog =>
            fog.id === updatedFogOfWar.id ? updatedFogOfWar : fog
        );

        const updatedScene = {
            ...scene,
            fogOfWar: updatedFogOfWarList
        };

        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });
    };

    // Handler for deleting fog of war
    const handleDeleteFogOfWar = (fogOfWarId: string) => {
        if (!scene.fogOfWar) return;

        const updatedFogOfWarList = scene.fogOfWar.filter(fog => fog.id !== fogOfWarId);

        const updatedScene = {
            ...scene,
            fogOfWar: updatedFogOfWarList
        };

        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });

        toast({
            title: "Fog of War Deleted",
            description: "Fog area removed",
            duration: 3000,
        });
    };

    const handleMoveEverything = (dx: number, dy: number) => {
        const updatedScene = {
            ...scene,
            maps: scene.maps.map(map => ({
                ...map,
                data: {
                    ...map.data,
                    position: {
                        x: map.data.position.x + dx,
                        y: map.data.position.y + dy
                    }
                }
            })),
            aoeMarkers: scene.aoeMarkers?.map(marker => ({
                ...marker,
                position: {
                    x: marker.position.x + dx,
                    y: marker.position.y + dy
                }
            })),
            fogOfWar: scene.fogOfWar?.map(fog => ({
                ...fog,
                points: fog.points.map(point => ({
                    x: point.x + dx,
                    y: point.y + dy
                }))
            }))
        };
        setScene(updatedScene);
        websocketService.send({
            type: 'scene_update',
            scene: updatedScene
        });

        // Show toast notification
        const direction = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
        const amount = Math.abs(dx || dy);
        toast({
            title: "Everything Moved",
            description: `All elements moved ${amount} grid cell${amount > 1 ? 's' : ''} ${direction}`,
            duration: 3000,
        });
    };

    const handleToggleViewerBlank = () => {
        const newBlankState = !isViewerBlanked;
        setIsViewerBlanked(newBlankState); // Only for tracking state in admin UI

        console.log(`Admin ${newBlankState ? 'blanking' : 'unblanking'} viewer`);

        // Send websocket command to blank/unblank viewers
        const message = {
            type: newBlankState ? 'blank_viewer' : 'unblank_viewer',
            isBlank: newBlankState
        };

        websocketService.send(message);

        toast({
            title: newBlankState ? "Viewer Blanked" : "Viewer Unblanked",
            description: newBlankState ? "Viewer screens are now blank" : "Viewer screens are now visible",
            duration: 3000,
        });
    };

    const handleToggleViewerRotate = () => {
        const newRotateState = !isViewerRotated;
        setIsViewerRotated(newRotateState); // Only for tracking state in admin UI

        console.log(`Admin ${newRotateState ? 'rotating' : 'unrotating'} viewer`);

        // Send websocket command to rotate/unrotate viewers
        const message = {
            type: newRotateState ? 'rotate_viewer' : 'unrotate_viewer',
            isRotated: newRotateState
        };

        websocketService.send(message);

        toast({
            title: newRotateState ? "Viewer Rotated" : "Viewer Unrotated",
            description: newRotateState ? "Entire viewer viewport is now rotated 180°" : "Viewer viewport is now upright",
            duration: 3000,
        });
    };

    return (
        <div className="flex h-screen bg-zinc-950 overflow-hidden" style={{ height: '100vh', width: '100vw', margin: 0, padding: 0 }}>
            {/* Main Content */}
            <div className="flex-1 relative w-full h-full overflow-hidden" style={{ height: '100%', width: '100%', margin: 0, padding: 0 }}>
                {(!scene.maps || scene.maps.length === 0) && (
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
                {/* Maps Container - Allow individual map z-indices based on their order */}
                <div className="absolute inset-0">
                    {scene.maps && scene.maps
                        .filter(map => !hideInvisibleMaps || !map.data.isHidden)
                        .map((map, index) => {
                            // Calculate z-index: active map gets highest, others get normal stacking
                            const isActive = map.name === scene.activeMapId;
                            const baseZIndex = (scene.maps?.length || 0) - index;
                            const zIndex = isActive ? (scene.maps?.length || 0) + 1 : baseZIndex;

                            return (
                                <Map
                                    key={map.name}
                                    map={map}
                                    isActive={isActive}
                                    onUpdate={handleMapUpdate}
                                    isViewerMode={isViewerMode}
                                    zIndex={zIndex}
                                    scale={displayScale}
                                    gridSettings={scene.gridSettings}
                                    onOpenAoEPalette={() => setIsAoEPaletteOpen(true)}
                                />
                            );
                        })}
                </div>

                {/* AoE Markers - Ensure they're above maps but below UI */}
                <div style={{ zIndex: (scene.maps?.length || 0) + 100 }}>
                    {scene.aoeMarkers && scene.aoeMarkers.map((marker) => (
                        <AoEMarker
                            key={marker.id}
                            marker={marker}
                            gridSize={scene.gridSettings.gridSize}
                            isActive={true}
                            isAdmin={isAdmin}
                            onUpdate={handleUpdateAoEMarker}
                            onDelete={handleDeleteAoEMarker}
                            scale={displayScale}
                            gridSettings={scene.gridSettings}
                            isHighlighted={marker.id === highlightedMarkerId}
                        />
                    ))}
                </div>

                {/* Fog of War - Above AoE markers but below grid */}
                <div style={{ zIndex: (scene.maps?.length || 0) + 150 }}>
                    {scene.fogOfWar && scene.fogOfWar.map((fog) => (
                        <FogOfWar
                            key={fog.id}
                            fogOfWar={fog}
                            gridSize={scene.gridSettings.gridSize}
                            isActive={true}
                            isAdmin={isAdmin}
                            isViewerMode={isViewerMode}
                            onUpdate={handleUpdateFogOfWar}
                            onDelete={handleDeleteFogOfWar}
                            scale={displayScale}
                            gridSettings={scene.gridSettings}
                            highlighted={fog.id === highlightedFogOfWarId}
                        />
                    ))}
                </div>

                {/* Grid Overlay - Always on top of maps and markers but below UI */}
                {scene.gridSettings?.showGrid && (
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: `
                                linear-gradient(to right, ${scene.gridSettings.gridColor || 'rgba(255, 255, 255, 0.1)'} 1px, transparent 1px),
                                linear-gradient(to bottom, ${scene.gridSettings.gridColor || 'rgba(255, 255, 255, 0.1)'} 1px, transparent 1px)
                            `,
                            backgroundSize: scene.gridSettings.useFixedGrid
                                ? `calc(100% / ${scene.gridSettings.gridCellsX || 25}) calc(100% / ${scene.gridSettings.gridCellsY || 13})`
                                : `${scene.gridSettings?.gridSize}px ${scene.gridSettings?.gridSize}px`,
                            opacity: scene.gridSettings.gridOpacity || 0.5,
                            zIndex: (scene.maps?.length || 0) + 200,
                        }}
                    />
                )}
            </div>

            {/* Map List Sidebar */}
            {!isViewerMode && showMapList && (
                <div className="!z-[9999]">
                    <MapListSidebar
                        scene={scene}
                        onMapSelect={handleMapSelect}
                        onMapVisibilityToggle={handleMapVisibilityToggle}
                        onMapAdd={() => setIsUploadOpen(true)}
                        onMapsReorder={handleMapsReorder}
                        onMapDelete={handleDeleteMap}
                        onClose={() => setShowMapList(false)}
                        onMapRefresh={handleMapRefresh}
                        onMapRename={handleMapRename}
                        hideInvisibleMaps={hideInvisibleMaps}
                        onToggleHideInvisibleMaps={() => setHideInvisibleMaps(!hideInvisibleMaps)}
                    />
                </div>
            )}

            {/* Show Map List Button - Only show when hidden and not in clean layout */}
            {!isViewerMode && !showMapList && !isCleanLayout && (
                <div className="absolute top-4 right-4 z-[1000]">
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

            {/* GameboardMenu - Only show in normal layout */}
            {!isCleanLayout && (
                <GameboardMenu connectionStatus={connectionStatus} />
            )}

            {/* Viewer Status Indicator - Only show when viewer is blanked */}
            {isViewerBlanked && (
                <div className="absolute top-16 right-4 px-3 py-2 bg-red-900/80 backdrop-blur-sm rounded-md border border-red-700/50 z-[1000]">
                    <div className="flex items-center gap-2">
                        <EyeOff className="h-4 w-4 text-red-400" />
                        <span className="text-xs text-red-400 font-medium">Viewer Blanked</span>
                    </div>
                </div>
            )}

            {/* Viewer Rotation Status Indicator - Only show when viewer is rotated */}
            {isViewerRotated && (
                <div className="absolute top-16 right-4 px-3 py-2 bg-blue-900/80 backdrop-blur-sm rounded-md border border-blue-700/50 z-[1000]" style={{ top: isViewerBlanked ? '6rem' : '4rem' }}>
                    <div className="flex items-center gap-2">
                        <RotateCw className="h-4 w-4 text-blue-400" />
                        <span className="text-xs text-blue-400 font-medium">Viewport Rotated 180°</span>
                    </div>
                </div>
            )}

            {/* Current Player Indicator - Only show when not in clean layout */}
            {!isAdmin && (
                <div className="!z-[9999]">
                    <InitiativeIndicator
                        initiativeOrder={scene.initiativeOrder}
                        showCurrentPlayer={scene.showCurrentPlayer}
                    />
                </div>
            )}

            {/* Initiative Sidebar */}
            {showInitiative && (
                <div className="!z-[9999]">
                    <InitiativeSidebar
                        isAdmin={isAdmin}
                        entries={scene.initiativeOrder}
                        onUpdate={handleInitiativeUpdate}
                        showCurrentPlayer={scene.showCurrentPlayer}
                        onToggleCurrentPlayer={handleToggleCurrentPlayer}
                        onClose={() => setShowInitiative(false)}
                    />
                </div>
            )}

            {/* Show Initiative Button - Only show when hidden and not in clean layout */}
            {!showInitiative && !isCleanLayout && (
                <div className="absolute left-4 bottom-4 z-[1000]">
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
                <div className="absolute top-4 left-4 z-[1000]">
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
                        <DropdownMenuContent className="w-64 bg-zinc-900/95 backdrop-blur-sm border-zinc-800 z-[1001]">


                            {/* Layout Toggle */}
                            <DropdownMenuItem
                                onClick={() => setIsCleanLayout(!isCleanLayout)}
                                className="flex items-center gap-2"
                            >
                                <LayoutGrid className="h-4 w-4" />
                                {isCleanLayout ? 'Show Full Menu' : 'Clean Layout'}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="bg-zinc-800" />

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


                            <DropdownMenuItem
                                className="text-xs cursor-pointer"
                                onClick={() => setIsAoEPaletteOpen(!isAoEPaletteOpen)}
                            >
                                <Zap className="h-4 w-4 mr-2" />
                                {isAoEPaletteOpen ? 'Hide AoE Palette' : 'Show AoE Palette'}
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
                                <DropdownMenuItem
                                    className="text-xs cursor-pointer"
                                    onClick={() => window.open('/initiative', '_blank')}
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Open Initiative Page
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-xs cursor-pointer"
                                    onClick={handleToggleViewerBlank}
                                >
                                    <EyeOff className="h-4 w-4 mr-2" />
                                    {isViewerBlanked ? 'Unblank Viewer' : 'Blank Viewer'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-xs cursor-pointer"
                                    onClick={handleToggleViewerRotate}
                                >
                                    <RotateCw className="h-4 w-4 mr-2" />
                                    {isViewerRotated ? 'Unrotate Viewer' : 'Rotate Viewer 180°'}
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
                                    <DropdownMenuItem
                                        className="text-xs cursor-pointer"
                                        onClick={() => setIsGridSettingsOpen(true)}
                                    >
                                        <Settings className="h-4 w-4 mr-2" />
                                        Grid Settings
                                    </DropdownMenuItem>
                                </div>
                            </div>

                            <DropdownMenuSeparator className="bg-zinc-800" />

                            {/* User Management - Only show for admin users */}
                            {isUserAdmin && (
                                <div className="px-2 py-1">
                                    <div className="flex items-center gap-2 px-2 py-1">
                                        <Shield className="h-4 w-4 text-zinc-400" />
                                        <span className="text-xs font-medium text-zinc-300">Admin</span>
                                    </div>
                                    <div className="space-y-1 mt-1">
                                        <DropdownMenuItem
                                            className="text-xs cursor-pointer"
                                            onClick={() => setIsUserManagementOpen(true)}
                                        >
                                            <UserPlus className="h-4 w-4 mr-2" />
                                            User Management
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-xs cursor-pointer"
                                            onClick={() => window.location.href = '/viewer/campaigns'}
                                        >
                                            <BookOpen className="h-4 w-4 mr-2" />
                                            Campaign Diary
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-xs cursor-pointer"
                                            onClick={() => setIsMonsterManagementOpen(true)}
                                        >
                                            <Skull className="h-4 w-4 mr-2" />
                                            Monster Management
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-xs cursor-pointer"
                                            onClick={logout}
                                        >
                                            <Users className="h-4 w-4 mr-2" />
                                            Logout ({user?.username})
                                        </DropdownMenuItem>
                                    </div>
                                </div>
                            )}

                            <DropdownMenuSeparator className="bg-zinc-800" />

                            <DropdownMenuItem onClick={() => setIsBackupDialogOpen(true)}>
                                <Database className="mr-2 h-4 w-4" />
                                <span>Backup & Restore</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="bg-zinc-800" />

                            {/* Move Everything */}
                            <DropdownMenuItem onClick={() => setIsMoveEverythingOpen(true)}>
                                <Move className="mr-2 h-4 w-4" />
                                <span>Move Everything</span>
                            </DropdownMenuItem>

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
                <div className="absolute bottom-4 right-4 z-[1000]">
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

            {/* AoE Palette Component */}
            <AoEPalette
                isOpen={isAoEPaletteOpen}
                onClose={() => setIsAoEPaletteOpen(false)}
                onAddMarker={handleAddAoEMarker}
                activeMarkers={scene.aoeMarkers || []}
                onDeleteMarker={handleDeleteAoEMarker}
                onHighlightMarker={(markerId) => {
                    // Find the marker and highlight it
                    const marker = scene.aoeMarkers?.find(m => m.id === markerId);
                    if (marker) {
                        // Set the highlighted marker ID to trigger the animation
                        setHighlightedMarkerId(markerId);

                        // Clear the highlight after a short delay
                        setTimeout(() => {
                            setHighlightedMarkerId(null);
                        }, 2100); // Slightly longer than the animation duration

                        // Broadcast the highlight to viewers
                        websocketService.send({
                            type: 'highlight_marker',
                            markerId: markerId
                        });

                        toast({
                            title: "Marker Highlighted",
                            description: marker.label || `${marker.shape} marker highlighted`,
                            duration: 2000,
                        });
                    }
                }}
            />

            {/* Fog of War Palette Component */}
            <FogOfWarPalette
                isOpen={isFogOfWarPaletteOpen}
                onClose={() => setIsFogOfWarPaletteOpen(false)}
                onAddFogOfWar={handleAddFogOfWar}
                activeFogOfWar={scene.fogOfWar || []}
                onDeleteFogOfWar={handleDeleteFogOfWar}
                onHighlightFogOfWar={(fogOfWarId) => {
                    // Find the fog of war and highlight it
                    const fog = scene.fogOfWar?.find(f => f.id === fogOfWarId);
                    if (fog) {
                        // Set the highlighted fog of war ID to trigger the animation
                        setHighlightedFogOfWarId(fogOfWarId);

                        // Clear the highlight after a short delay
                        setTimeout(() => {
                            setHighlightedFogOfWarId(null);
                        }, 2100); // Slightly longer than the animation duration

                        toast({
                            title: "Fog of War Highlighted",
                            description: `Fog area highlighted`,
                            duration: 2000,
                        });
                    }
                }}
            />

            {/* Add Display Calculator Dialog */}
            <DisplayCalculator
                isOpen={isDisplayCalculatorOpen || isGridSettingsOpen}
                onClose={() => {
                    setIsDisplayCalculatorOpen(false);
                    setIsGridSettingsOpen(false);
                }}
                currentGridSize={scene.gridSettings.gridSize}
                gridSettings={scene.gridSettings}
                onApplyGridSize={(size) => handleUpdateGridSettings({ gridSize: size })}
                onUpdateGridSettings={handleUpdateGridSettings}
            />

            {/* Backup Dialog */}
            <BackupDialog
                isOpen={isBackupDialogOpen}
                onClose={() => setIsBackupDialogOpen(false)}
            />

            {/* Move Everything Dialog */}
            <MoveEverythingDialog
                isOpen={isMoveEverythingOpen}
                onClose={() => setIsMoveEverythingOpen(false)}
                onMove={handleMoveEverything}
            />

            {/* User Management Dialog */}
            <UserManagementDialog
                isOpen={isUserManagementOpen}
                onClose={() => setIsUserManagementOpen(false)}
            />

            {/* Monster Management Dialog */}
            <MonsterManagementDialog
                isOpen={isMonsterManagementOpen}
                onClose={() => setIsMonsterManagementOpen(false)}
            />

            {/* AoE and Fog of War Palette Toggle Buttons - Only show when not in clean layout */}
            {!isViewerMode && !isCleanLayout && (
                <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 z-[1000] flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-zinc-900/80 backdrop-blur-sm"
                        onClick={() => setIsAoEPaletteOpen(!isAoEPaletteOpen)}
                    >
                        <Zap className="h-4 w-4" />
                        {isAoEPaletteOpen ? 'Hide AoE' : 'Show AoE'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-zinc-900/80 backdrop-blur-sm"
                        onClick={() => setIsFogOfWarPaletteOpen(!isFogOfWarPaletteOpen)}
                    >
                        <Eye className="h-4 w-4" />
                        {isFogOfWarPaletteOpen ? 'Hide Fog' : 'Show Fog'}
                    </Button>
                </div>
            )}
        </div>
    );
}; 