"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene as SceneType, MapData, AoEMarker as AoEMarkerType, FogOfWar as FogOfWarType } from '../types/map';
import { Map } from './Map';
import { websocketService } from '@/services/websocket';
import { UploadDialog } from './UploadDialog';
import { MapUploadCompleteResult } from './MapUploadDialog';
import { Button } from '@/components/ui/button';
import {
    LayoutGrid,
    Users,
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
    BookOpen,
    Skull,
    Menu,
    Map as MapIcon,
    Cloud,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { GameboardDock } from '@/components/gameboard/GameboardDock';
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
import {
    adaptAoEMarkersSnap,
    getPlayAreaRect,
    migrateAoEMarkers,
} from '@/utils/aoeCoordinates';
import { FogOfWarPalette } from './FogOfWarPalette';
import { DisplayCalculator } from './DisplayCalculator';
import { BackupDialog } from './BackupDialog';
import { GameboardMenu } from './GameboardMenu';
import { MoveEverythingDialog } from './MoveEverythingDialog';
import { UserManagementDialog } from './UserManagementDialog';
import { useAuth } from '@/contexts/AuthContext';
import {getApiUrl} from "@/utils/api";
import {MonsterManagementDialog} from "@/components/MonsterManagementDialog";

function withMigratedAoEMarkers(
    scene: SceneType,
    container: HTMLElement | null
): SceneType {
    const rect = getPlayAreaRect(container);
    return {
        ...scene,
        aoeMarkers: migrateAoEMarkers(scene.aoeMarkers, rect),
    };
}

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
    const title =
        type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{message}</DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
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
    const playAreaRef = useRef<HTMLDivElement>(null);

    const applySceneWithAoEMigration = useCallback(
        (nextScene: SceneType): SceneType =>
            withMigratedAoEMarkers(nextScene, playAreaRef.current),
        []
    );

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

                setScene(
                    applySceneWithAoEMigration({
                        ...data.scene,
                        gridSettings: data.scene.gridSettings || {
                            showGrid: true,
                            gridSize: 50
                        },
                        aoeMarkers: data.scene.aoeMarkers || [],
                        fogOfWar: data.scene.fogOfWar || []
                    })
                );
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

    const createMapDataForScene = (
        mapName: string,
        mapInfo?: { folder?: string | null }
    ): MapData => {
        const gridCellsX = scene.gridSettings.gridCellsX || 32;
        const gridCellsY = scene.gridSettings.gridCellsY || 18;
        const centerGridX = Math.floor(gridCellsX / 2);
        const centerGridY = Math.floor(gridCellsY / 2);

        return {
            name: mapName,
            folder: mapInfo?.folder ?? undefined,
            data: {
                position: { x: centerGridX, y: centerGridY },
                useGridCoordinates: true,
                useGridScaling: true,
                scale: 1,
                rotation: 0,
                isHidden: false,
            },
        };
    };

    const addMapsToScene = async (mapNames: string[]) => {
        const uniqueNames = [...new Set(mapNames.filter(Boolean))];
        if (uniqueNames.length === 0) return;

        const namesToAdd = uniqueNames.filter(
            (name) => !scene.maps.some((m) => m.name === name)
        );

        try {
            let mapsToAppend: MapData[] = [];

            if (namesToAdd.length > 0) {
                const API_BASE_URL = getApiUrl();
                const listResponse = await fetch(`${API_BASE_URL}/maps/list`);
                if (!listResponse.ok) throw new Error('Failed to fetch map list');

                const listData = await listResponse.json();
                const libraryMaps: { name: string; folder?: string | null }[] =
                    listData.maps || [];

                const notFound: string[] = [];
                for (const mapName of namesToAdd) {
                    const mapInfo = libraryMaps.find((m) => m.name === mapName);
                    if (!mapInfo) {
                        notFound.push(mapName);
                        continue;
                    }
                    mapsToAppend.push(createMapDataForScene(mapName, mapInfo));
                }

                if (notFound.length > 0) {
                    toast({
                        title: 'Warning',
                        description: `Map(s) not found in library: ${notFound.join(', ')}`,
                        variant: 'destructive',
                        duration: 3000,
                    });
                }
            }

            const activeMapId = uniqueNames[uniqueNames.length - 1];
            const updatedScene = {
                ...scene,
                maps: [...scene.maps, ...mapsToAppend],
                activeMapId,
            };

            setScene(updatedScene);
            websocketService.send({
                type: 'scene_update',
                scene: updatedScene,
            });

            if (mapsToAppend.length > 0) {
                toast({
                    title: 'Maps Added',
                    description:
                        mapsToAppend.length === 1
                            ? `Map "${mapsToAppend[0].name}" added to scene`
                            : `${mapsToAppend.length} maps added to scene`,
                    duration: 3000,
                });
            }
        } catch (error) {
            console.error('Error adding maps to scene:', error);
            toast({
                title: 'Error',
                description: 'Failed to add maps to scene. Please try again.',
                variant: 'destructive',
                duration: 3000,
            });
        }
    };

    const handleMapsAdd = (mapNames: string[]) => {
        void addMapsToScene(mapNames);
    };

    const handleMapSelect = async (mapName: string | null) => {
        if (!mapName) {
            const updatedScene = {
                ...scene,
                activeMapId: null,
            };
            setScene(updatedScene);
            websocketService.send({
                type: 'scene_update',
                scene: updatedScene,
            });
            return;
        }

        await addMapsToScene([mapName]);
    };

    const handleUpload = async (results: MapUploadCompleteResult[]) => {
        if (results.length === 0) return;
        await addMapsToScene(results.map((r) => r.filename));
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
        const mergedGridSettings = { ...scene.gridSettings, ...newGridSettings };
        const wasSnap = scene.gridSettings.aoeSnapToGrid !== false;
        const willSnap = mergedGridSettings.aoeSnapToGrid !== false;

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
            let updatedMarkers = scene.aoeMarkers ? scene.aoeMarkers.map(marker => {
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

            if (!willSnap) {
                const gridCellsX =
                    newGridSettings.gridCellsX || scene.gridSettings.gridCellsX || 25;
                const gridCellsY =
                    newGridSettings.gridCellsY || scene.gridSettings.gridCellsY || 13;
                updatedMarkers = updatedMarkers.map((m) => ({
                    ...m,
                    position: {
                        x: (m.position.x + 0.5) / gridCellsX,
                        y: (m.position.y + 0.5) / gridCellsY,
                    },
                    useGridCoordinates: false,
                }));
            }

            // Update the scene with converted coordinates and new grid settings
            let updatedScene = {
                ...scene,
                gridSettings: mergedGridSettings,
                maps: updatedMaps,
                aoeMarkers: updatedMarkers
            };

            if (wasSnap !== willSnap) {
                updatedScene = {
                    ...updatedScene,
                    aoeMarkers: adaptAoEMarkersSnap(
                        updatedScene.aoeMarkers,
                        willSnap,
                        mergedGridSettings.gridCellsX || 25,
                        mergedGridSettings.gridCellsY || 13
                    ),
                };
            }

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

            let updatedScene: SceneType = {
                ...scene,
                gridSettings: mergedGridSettings,
                maps: updatedMaps
            };

            if (wasSnap !== willSnap) {
                updatedScene = {
                    ...updatedScene,
                    aoeMarkers: adaptAoEMarkersSnap(
                        updatedScene.aoeMarkers,
                        willSnap,
                        mergedGridSettings.gridCellsX || 25,
                        mergedGridSettings.gridCellsY || 13
                    ),
                };
            }

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
            let updatedScene: SceneType = {
                ...scene,
                gridSettings: mergedGridSettings
            };

            if (wasSnap !== willSnap) {
                updatedScene = {
                    ...updatedScene,
                    aoeMarkers: adaptAoEMarkersSnap(
                        updatedScene.aoeMarkers,
                        willSnap,
                        mergedGridSettings.gridCellsX || 25,
                        mergedGridSettings.gridCellsY || 13
                    ),
                };
            }

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

        const aoeSnapToGrid = scene.gridSettings.aoeSnapToGrid !== false;

        const newMarker: AoEMarkerType = {
            ...markerData,
            id: Date.now().toString(),
            position: aoeSnapToGrid
                ? { x: centerGridX, y: centerGridY }
                : { x: 0.5, y: 0.5 },
            useGridCoordinates: aoeSnapToGrid
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
        <div className="dark flex h-dvh w-dvw overflow-hidden bg-gameboard">
            {/* Main Content */}
            <div
                ref={playAreaRef}
                className="flex-1 relative w-full h-full overflow-hidden"
                style={{ height: '100%', width: '100%', margin: 0, padding: 0 }}
            >
                {(!scene.maps || scene.maps.length === 0) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <div className="glass-panel flex max-w-sm flex-col items-center gap-4 rounded-xl p-6">
                            <div className="rounded-lg bg-muted/50 p-3">
                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-foreground">
                                    Welcome to SpellTable
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Upload your first map to get started
                                </p>
                            </div>
                            <Button
                                variant="default"
                                className="gap-2"
                                onClick={() => setIsUploadOpen(true)}
                            >
                                <Upload className="h-4 w-4" />
                                Upload Maps
                            </Button>
                        </div>
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
                            containerRef={playAreaRef}
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

                {/* Grid Overlay - above maps/markers, below initiative UI */}
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

                {!isAdmin && scene.showCurrentPlayer && (
                    <InitiativeIndicator
                        initiativeOrder={scene.initiativeOrder}
                        showCurrentPlayer={scene.showCurrentPlayer}
                    />
                )}
            </div>

            {/* Map List Sidebar */}
            {!isViewerMode && showMapList && (
                <div className="!z-[9999]">
                    <MapListSidebar
                        scene={scene}
                        onMapSelect={handleMapSelect}
                        onMapsAdd={handleMapsAdd}
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

            {/* GameboardMenu - Only show in normal layout */}
            {!isCleanLayout && (
                <GameboardMenu connectionStatus={connectionStatus} />
            )}

            {/* Viewer Status Indicator - Only show when viewer is blanked */}
            {isViewerBlanked && (
                <div className="glass-panel absolute top-4 right-4 z-[1000] rounded-md border-destructive/50 bg-destructive/10 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <EyeOff className="h-4 w-4 text-destructive" />
                        <span className="text-xs font-medium text-destructive">
                            Viewer Blanked
                        </span>
                    </div>
                </div>
            )}

            {isViewerRotated && (
                <div
                    className={cn(
                        'glass-panel absolute right-4 z-[1000] rounded-md border-primary/50 bg-primary/10 px-3 py-2',
                        isViewerBlanked ? 'top-16' : 'top-4'
                    )}
                >
                    <div className="flex items-center gap-2">
                        <RotateCw className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-primary">
                            Viewport Rotated 180°
                        </span>
                    </div>
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

            {/* Floating Menu Button - Only show in non-viewer mode */}
            {!isViewerMode && (
                <div className="absolute top-4 left-4 z-[1000]">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size={isCleanLayout ? 'icon' : 'sm'}
                                className={cn('glass-panel', !isCleanLayout && 'gap-2')}
                            >
                                <Menu className="h-4 w-4" />
                                {!isCleanLayout && <span>Menu</span>}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="glass-panel z-[1001] w-64 border-border/50">

                            {/* Scene Management */}
                            <div className="px-2 py-1">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Settings className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs font-medium text-foreground">Scene</span>
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

                            <DropdownMenuSeparator />

                            {/* Players Section */}
                            <div className="px-2 py-1">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs font-medium text-foreground">Players</span>
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

                            <DropdownMenuSeparator />

                            {/* Grid Settings */}
                            <div className="px-2 py-1">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Grid className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs font-medium text-foreground">Grid</span>
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

                            <DropdownMenuSeparator />

                            {/* User Management - Only show for admin users */}
                            {isUserAdmin && (
                                <div className="px-2 py-1">
                                    <div className="flex items-center gap-2 px-2 py-1">
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-xs font-medium text-foreground">Admin</span>
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

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={() => setIsBackupDialogOpen(true)}>
                                <Database className="mr-2 h-4 w-4" />
                                <span>Backup & Restore</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

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

            {/* Tool dock */}
            {!isViewerMode && (
                <div className="absolute bottom-5 left-1/2 z-[1000] -translate-x-1/2">
                    <GameboardDock
                        items={[
                            {
                                id: 'initiative',
                                label: showInitiative ? 'Hide initiative' : 'Show initiative',
                                icon: <Users className="h-4 w-4" />,
                                active: showInitiative,
                                onClick: () => setShowInitiative(!showInitiative),
                            },
                            {
                                id: 'maps',
                                label: showMapList ? 'Hide maps' : 'Show maps',
                                icon: <MapIcon className="h-4 w-4" />,
                                active: showMapList,
                                onClick: () => setShowMapList(!showMapList),
                            },
                            {
                                id: 'soundboard',
                                label: isSoundboardOpen ? 'Hide soundboard' : 'Show soundboard',
                                icon: <Music className="h-4 w-4" />,
                                active: isSoundboardOpen,
                                onClick: () => setIsSoundboardOpen(!isSoundboardOpen),
                            },
                            {
                                id: 'aoe',
                                label: isAoEPaletteOpen ? 'Hide AoE palette' : 'Show AoE palette',
                                icon: <Zap className="h-4 w-4" />,
                                active: isAoEPaletteOpen,
                                onClick: () => setIsAoEPaletteOpen(!isAoEPaletteOpen),
                            },
                            {
                                id: 'fog',
                                label: isFogOfWarPaletteOpen ? 'Hide fog' : 'Show fog',
                                icon: <Cloud className="h-4 w-4" />,
                                active: isFogOfWarPaletteOpen,
                                onClick: () =>
                                    setIsFogOfWarPaletteOpen(!isFogOfWarPaletteOpen),
                            },
                            {
                                id: 'layout',
                                label: isCleanLayout ? 'Full layout' : 'Clean layout',
                                icon: <LayoutGrid className="h-4 w-4" />,
                                active: isCleanLayout,
                                onClick: () => setIsCleanLayout(!isCleanLayout),
                            },
                        ]}
                    />
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
                aoeEffectTheme={scene.gridSettings.aoeEffectTheme ?? 'pixel'}
                onThemeChange={(theme) =>
                    handleUpdateGridSettings({ ...scene.gridSettings, aoeEffectTheme: theme })
                }
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

        </div>
    );
}; 