import React, { useState, useEffect } from 'react';
import { MapData } from '../types/map';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useToast } from './ui/use-toast';
import { Folder, FolderPlus, FolderMinus, ChevronRight, ChevronDown, Map, Upload, Pencil, Trash2 } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    useDroppable,
    DragEndEvent,
    DragStartEvent,
    DragOverEvent,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../lib/utils';
import { createPortal } from 'react-dom';

interface FolderItem {
    name: string;
    type: 'folder';
    path: string;
    parent: string;
}

interface MapManagementProps {
    isOpen: boolean;
    onClose: () => void;
    onMapSelect: (mapName: string) => void;
    onRefreshMaps: () => void;
    onMapRename?: (oldName: string, newName: string) => void;
    maps: MapData[];
}

interface SortableMapItemProps {
    map: MapData;
    folder: string | null;
    level: number;
    onSelect: (mapName: string) => void;
    onRename: (map: MapData, newName: string) => void;
    onDelete: (mapName: string) => void;
    dragOverlay?: boolean;
}

interface DroppableFolderProps {
    folder: FolderItem;
    level: number;
    isExpanded: boolean;
    onToggle: () => void;
    onAddSubfolder: () => void;
    onDelete: () => void;
    onUpload: () => void;
}

const DroppableFolder: React.FC<DroppableFolderProps> = ({
    folder,
    level,
    isExpanded,
    onToggle,
    onAddSubfolder,
    onDelete,
    onUpload,
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: folder.path,
        data: {
            type: 'folder',
            folderPath: folder.path,
            accepts: 'map'
        }
    });

    return (
        <div
            ref={setNodeRef}
            style={{ marginLeft: `${level * 20}px` }}
            className={cn(
                "flex items-center justify-between p-2 rounded-md mb-1 cursor-pointer",
                isOver ? "bg-blue-500/30 border border-blue-500" : "hover:bg-zinc-800/50"
            )}
            onClick={onToggle}
        >
            <div className="flex items-center gap-2 flex-1">
                {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                ) : (
                    <ChevronRight className="h-4 w-4" />
                )}
                <Folder className="h-4 w-4 text-zinc-400" />
                <span className="truncate">{folder.name}</span>
            </div>
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onUpload();
                    }}
                    title="Upload map to this folder"
                >
                    <Upload className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddSubfolder();
                    }}
                    title="Create subfolder"
                >
                    <FolderPlus className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    title="Delete folder"
                >
                    <FolderMinus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

// DragOverlayWrapper helps ensure proper overlay positioning
const DragOverlayWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // This creates a portal directly to the document body
    // which avoids issues with nested scroll containers or CSS transformations
    return createPortal(
        <div
            style={{
                position: 'fixed',
                pointerEvents: 'none',
                zIndex: 999,
                left: 0,
                top: 0,
                width: '100%',
                height: '100%'
            }}
        >
            {children}
        </div>,
        document.body
    );
};

const SortableMapItem: React.FC<SortableMapItemProps> = ({
    map,
    folder,
    level,
    onSelect,
    onRename,
    onDelete,
    dragOverlay
}) => {
    // Split the filename into base name and extension
    const getFileNameParts = (fileName: string) => {
        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex === -1) {
            // No extension
            return { baseName: fileName, extension: '' };
        }
        const baseName = fileName.substring(0, lastDotIndex);
        const extension = fileName.substring(lastDotIndex);
        return { baseName, extension };
    };

    const { baseName, extension } = getFileNameParts(map.name);

    const [isRenaming, setIsRenaming] = useState(false);
    const [newBaseName, setNewBaseName] = useState(baseName);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: map.name,
        data: {
            type: 'map',
            currentFolder: folder,
            map: map
        }
    });

    const style = dragOverlay
        ? {
            opacity: 0.8,
        }
        : {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
        };

    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedBaseName = newBaseName.trim();

        if (trimmedBaseName && trimmedBaseName !== baseName) {
            // Combine the new base name with the original extension
            const newFullName = trimmedBaseName + extension;
            onRename(map, newFullName);
        }
        setIsRenaming(false);
    };

    return (
        <div
            ref={!dragOverlay ? setNodeRef : undefined}
            style={{ ...style, marginLeft: `${level * 20}px` }}
            className="flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded-md cursor-move"
            {...(!dragOverlay ? { ...attributes, ...listeners } : {})}
        >
            <div className="flex items-center gap-2 flex-1">
                <Map className="h-4 w-4 text-zinc-400" />
                {isRenaming && !dragOverlay ? (
                    <form onSubmit={handleRenameSubmit} className="flex-1">
                        <div className="flex items-center">
                            <Input
                                className="h-7 py-1 text-xs"
                                value={newBaseName}
                                onChange={(e) => setNewBaseName(e.target.value)}
                                autoFocus
                                onBlur={handleRenameSubmit}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-xs text-zinc-400 ml-1">{extension}</span>
                        </div>
                    </form>
                ) : (
                    <span className="truncate">{map.name}</span>
                )}
            </div>
            {!isRenaming && !dragOverlay && (
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            setNewBaseName(baseName); // Reset to current base name
                            setIsRenaming(true);
                        }}
                        title="Rename map"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(map.name);
                        }}
                        title="Delete map"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log("Selected map:", map.name);
                            onSelect(map.name);
                        }}
                    >
                        Use
                    </Button>
                </div>
            )}
        </div>
    );
};

export const MapManagement: React.FC<MapManagementProps> = ({
    isOpen,
    onClose,
    onMapSelect,
    onRefreshMaps,
    onMapRename,
    maps
}) => {
    const { toast } = useToast();
    const [mapFolders, setMapFolders] = useState<FolderItem[]>([]);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [parentFolder, setParentFolder] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeMap, setActiveMap] = useState<MapData | null>(null);
    const [overFolder, setOverFolder] = useState<string | null>(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadFolder, setUploadFolder] = useState<string | null>(null);
    const [mapsByFolder, setMapsByFolder] = useState<Record<string, MapData[]>>({});
    const [allAvailableMaps, setAllAvailableMaps] = useState<MapData[]>([]);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'map' | 'folder', name: string } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Start dragging after moving 5px to avoid accidental drags
            }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const loadAllMaps = async () => {
        try {
            const response = await fetch('http://localhost:8010/maps/list');
            if (!response.ok) throw new Error('Failed to load maps');

            const data = await response.json();
            const availableMaps = data.maps || [];

            // Convert the simplified map objects from the API to MapData objects
            const convertedMaps: MapData[] = availableMaps.map((m: { name: string, folder?: string }) => ({
                name: m.name,
                folder: m.folder,
                data: {
                    position: { x: 0, y: 0 },
                    scale: 1,
                    rotation: 0,
                    isHidden: true
                }
            }));

            setAllAvailableMaps(convertedMaps);

            // Process maps into folders
            const folderMaps: Record<string, MapData[]> = {};
            convertedMaps.forEach(map => {
                const folder = map.folder || 'root';
                if (!folderMaps[folder]) folderMaps[folder] = [];
                folderMaps[folder].push(map);
            });

            setMapsByFolder(folderMaps);
        } catch (error) {
            console.error('Error loading maps:', error);
            toast({
                title: "Error",
                description: "Failed to load maps. Please try again.",
                variant: "destructive",
            });
        }
    };

    const loadMapFolders = async () => {
        try {
            console.log("Loading map folders...");
            const response = await fetch('http://localhost:8010/maps/folders');
            if (!response.ok) throw new Error('Failed to load map folders');

            const data = await response.json();
            console.log("Received folder data:", data);

            const folders = data.folders || [];
            console.log('Loaded folders:', folders);

            // Expand all folders by default for testing - use proper typing
            const allFolderPaths = new Set<string>(folders.map((f: FolderItem) => f.path));
            console.log("Setting expanded folders:", allFolderPaths);
            setExpandedFolders(allFolderPaths);

            setMapFolders(folders);
        } catch (error) {
            console.error('Error loading map folders:', error);
            toast({
                title: "Error",
                description: "Failed to load map folders. Please try again.",
                variant: "destructive",
            });
        }
    };

    const refreshData = () => {
        loadAllMaps();
        loadMapFolders();
        onRefreshMaps();
    };

    useEffect(() => {
        if (isOpen) {
            console.log("MapManagement dialog opened, loading data...");
            loadAllMaps();
            loadMapFolders();
        }
    }, [isOpen]);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) {
            toast({
                title: "Error",
                description: "Folder name cannot be empty",
                variant: "destructive",
            });
            return;
        }

        try {
            const response = await fetch('http://localhost:8010/maps/folder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    folder_name: newFolderName,
                    parent_folder: parentFolder || undefined
                }),
            });

            if (!response.ok) throw new Error('Failed to create folder');

            toast({
                title: "Success",
                description: "Folder created successfully",
            });

            setNewFolderName('');
            setParentFolder(null);
            setIsCreateFolderOpen(false);
            refreshData();
        } catch (error) {
            console.error('Error creating folder:', error);
            toast({
                title: "Error",
                description: "Failed to create folder. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleDeleteFolder = async (folderName: string) => {
        try {
            const response = await fetch(`http://localhost:8010/maps/folder/${folderName}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete folder');

            toast({
                title: "Success",
                description: "Folder deleted successfully",
            });

            refreshData();
        } catch (error) {
            console.error('Error deleting folder:', error);
            toast({
                title: "Error",
                description: "Failed to delete folder. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleUploadMap = async (file: File, folder: string | null) => {
        const formData = new FormData();
        formData.append('file', file);
        if (folder) {
            formData.append('folder', folder);
        }

        try {
            const response = await fetch('http://localhost:8010/maps/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');

            toast({
                title: "Success",
                description: "Map uploaded successfully",
            });
            refreshData();
            setIsUploadOpen(false);
        } catch (error) {
            console.error('Error uploading map:', error);
            toast({
                title: "Error",
                description: "Failed to upload map. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleRenameMap = async (map: MapData, newName: string) => {
        try {
            console.log(`Renaming map from "${map.name}" to "${newName}"`);

            const response = await fetch(`http://localhost:8010/maps/rename/${encodeURIComponent(map.name)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ new_name: newName }),
            });

            console.log(`Rename response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Rename failed with status ${response.status}: ${errorText}`);
                throw new Error(`Failed to rename map: ${errorText}`);
            }

            const data = await response.json();
            console.log("Rename response data:", data);

            const oldName = map.name; // Store the old name before refreshing

            // Check if any scenes were updated
            const scenesUpdated = data.scenes_updated || 0;
            const sceneMessage = scenesUpdated > 0
                ? `Updated references in ${scenesUpdated} scene${scenesUpdated === 1 ? '' : 's'}.`
                : '';

            toast({
                title: "Success",
                description: `Map renamed to "${newName}". ${sceneMessage}`,
            });

            // Call onMapRename if provided
            if (onMapRename) {
                console.log(`Calling onMapRename with old name: ${oldName}, new name: ${newName}`);
                onMapRename(oldName, newName);

                // Add a small delay before refreshing data to ensure scene updates complete first
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            refreshData();
        } catch (error) {
            console.error('Error renaming map:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to rename map. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleDeleteMap = async (mapName: string) => {
        if (!confirm(`Are you sure you want to delete the map "${mapName}"?`)) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:8010/maps/file/${mapName}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete map');

            toast({
                title: "Success",
                description: "Map deleted successfully",
            });
            refreshData();
        } catch (error) {
            console.error('Error deleting map:', error);
            toast({
                title: "Error",
                description: "Failed to delete map. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleMoveMap = async (mapName: string, targetFolder: string | null) => {
        try {
            const response = await fetch(`http://localhost:8010/maps/move/${mapName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ folder: targetFolder || null }),
            });

            if (!response.ok) throw new Error('Failed to move map');

            toast({
                title: "Success",
                description: "Map moved successfully",
            });
            refreshData();
        } catch (error) {
            console.error('Error moving map:', error);
            toast({
                title: "Error",
                description: "Failed to move map. Please try again.",
                variant: "destructive",
            });
        }
    };

    const toggleFolder = (folderName: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderName)) {
                newSet.delete(folderName);
            } else {
                newSet.add(folderName);
            }
            return newSet;
        });
    };

    const handleDragStart = (event: DragStartEvent) => {
        console.log('Drag start:', event.active.id);
        setActiveId(event.active.id as string);

        // Find the map being dragged
        if (event.active.data.current?.type === 'map') {
            const mapName = event.active.id as string;
            const folder = event.active.data.current.currentFolder;

            const map = mapsByFolder[folder || 'root']?.find(m => m.name === mapName) || null;
            setActiveMap(map);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;

        // If over a folder, highlight it
        if (over && over.data.current?.type === 'folder') {
            setOverFolder(over.id as string);
        } else {
            setOverFolder(null);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        // Clear states
        setActiveId(null);
        setActiveMap(null);
        setOverFolder(null);

        if (!over) return;

        console.log('Drag end:', active.id, 'over:', over.id);

        // Get data from the draggable elements
        const activeData = active.data.current;
        const overData = over.data.current;

        // If item is dropped on itself, do nothing
        if (active.id === over.id) return;

        // Handle drop on a folder
        if (overData?.type === 'folder') {
            const targetFolder = over.id as string;
            const sourceMapName = active.id as string;

            // Get current folder from active data if available, otherwise try to find it
            let currentFolder = null;
            if (activeData?.currentFolder) {
                currentFolder = activeData.currentFolder;
            } else {
                // Search each folder for the map
                for (const [folderPath, mapsInFolder] of Object.entries(mapsByFolder)) {
                    if (mapsInFolder.some(m => m.name === sourceMapName)) {
                        currentFolder = folderPath === 'root' ? null : folderPath;
                        break;
                    }
                }
            }

            // Only move if target folder is different from current
            const normalizedTargetFolder = targetFolder === 'root' ? null : targetFolder;
            const shouldMove = normalizedTargetFolder !== currentFolder;

            if (shouldMove) {
                console.log(`Moving map ${sourceMapName} from ${currentFolder} to ${normalizedTargetFolder}`);
                await handleMoveMap(sourceMapName, normalizedTargetFolder);

                // Auto-expand the folder where the item was dropped
                if (normalizedTargetFolder) {
                    setExpandedFolders(prev => {
                        const newSet = new Set(prev);
                        newSet.add(normalizedTargetFolder);
                        return newSet;
                    });
                }
            }
        }
        // Handle reordering within the same folder
        else if (active.id !== over.id) {
            let sourceFolder = null;
            let targetFolder = null;

            // Try to get folders from data
            if (activeData?.currentFolder && overData?.currentFolder) {
                sourceFolder = activeData.currentFolder === 'root' ? 'root' : activeData.currentFolder;
                targetFolder = overData.currentFolder === 'root' ? 'root' : overData.currentFolder;
            } else {
                // Find folders by searching in mapsByFolder
                for (const [folderPath, mapsInFolder] of Object.entries(mapsByFolder)) {
                    if (mapsInFolder.some(m => m.name === active.id)) {
                        sourceFolder = folderPath;
                    }
                    if (mapsInFolder.some(m => m.name === over.id)) {
                        targetFolder = folderPath;
                    }
                }
            }

            // If same folder, reorder
            if (sourceFolder === targetFolder && mapsByFolder[sourceFolder]) {
                const oldIndex = mapsByFolder[sourceFolder].findIndex(m => m.name === active.id);
                const newIndex = mapsByFolder[sourceFolder].findIndex(m => m.name === over.id);

                if (oldIndex !== -1 && newIndex !== -1) {
                    console.log(`Reordering map ${active.id} in folder ${sourceFolder}`);
                    const newMaps = arrayMove([...mapsByFolder[sourceFolder]], oldIndex, newIndex);
                    const updatedMapsByFolder = {
                        ...mapsByFolder,
                        [sourceFolder]: newMaps
                    };
                    setMapsByFolder(updatedMapsByFolder);
                }
            }
        }
    };

    const renderFolderTree = (parent: string | null = null, level: number = 0) => {
        // This function now only handles sub-folders, not top-level ones
        console.log(`Rendering sub-folders for parent: ${parent}, level: ${level}`);

        // Filter for direct children of the given parent
        const childFolders = mapFolders.filter(f => f.parent === parent);
        console.log(`Found ${childFolders.length} sub-folders for parent ${parent}:`, childFolders);

        return childFolders.map(folder => (
            <div key={folder.path}>
                <DroppableFolder
                    folder={folder}
                    level={level}
                    isExpanded={expandedFolders.has(folder.path)}
                    onToggle={() => toggleFolder(folder.path)}
                    onAddSubfolder={() => {
                        setParentFolder(folder.path);
                        setIsCreateFolderOpen(true);
                    }}
                    onDelete={() => confirmDeleteFolder(folder.name)}
                    onUpload={() => {
                        setUploadFolder(folder.path);
                        setIsUploadOpen(true);
                    }}
                />

                {expandedFolders.has(folder.path) && (
                    <>
                        {/* Recursive call for deeper sub-folders */}
                        {renderFolderTree(folder.path, level + 1)}

                        {/* Maps in this folder */}
                        <SortableContext
                            items={(mapsByFolder[folder.path] || []).map(map => map.name)}
                            strategy={verticalListSortingStrategy}
                        >
                            {(mapsByFolder[folder.path] || []).map(map => (
                                <SortableMapItem
                                    key={map.name}
                                    map={map}
                                    folder={folder.path}
                                    level={level + 1}
                                    onSelect={(mapName) => {
                                        console.log("Selected map:", mapName);
                                        onMapSelect(mapName);
                                        onClose();
                                    }}
                                    onRename={handleRenameMap}
                                    onDelete={confirmDeleteMap}
                                />
                            ))}
                        </SortableContext>
                    </>
                )}
            </div>
        ));
    };

    const { setNodeRef: setRootNodeRef, isOver: isRootOver } = useDroppable({
        id: 'root',
        data: {
            type: 'folder',
            folderPath: 'root',
            accepts: 'map'
        }
    });

    const confirmDeleteFolder = (folderName: string) => {
        setItemToDelete({ type: 'folder', name: folderName });
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteMap = (mapName: string) => {
        setItemToDelete({ type: 'map', name: mapName });
        setDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        if (!itemToDelete) return;

        try {
            if (itemToDelete.type === 'folder') {
                await handleDeleteFolder(itemToDelete.name);
            } else {
                await handleDeleteMap(itemToDelete.name);
            }
        } catch (error) {
            console.error(`Error deleting ${itemToDelete.type}:`, error);
        } finally {
            setDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    // Custom dropAnimation with proper positioning
    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Map Management</DialogTitle>
                    <DialogDescription>
                        Manage your maps and folders
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setParentFolder(null);
                                setIsCreateFolderOpen(true);
                            }}
                            className="gap-2"
                        >
                            <FolderPlus className="h-4 w-4" />
                            New Folder
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setUploadFolder(null);
                                setIsUploadOpen(true);
                            }}
                            className="gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            Upload Map
                        </Button>
                    </div>

                    {/* Debug folder information */}
                    <div className="text-xs text-zinc-500 mb-2">
                        Folders available: {mapFolders.length}
                    </div>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                        modifiers={[
                            // This modifier will adjust the overlay position to be at the cursor
                            // by offsetting its center point
                            ({ activatorEvent, transform }) => {
                                if (activatorEvent && 'clientX' in activatorEvent) {
                                    const offsetX = 20; // Adjust if needed
                                    const offsetY = 10; // Adjust if needed
                                    return {
                                        ...transform,
                                        x: transform.x - offsetX,
                                        y: transform.y - offsetY,
                                    };
                                }
                                return transform;
                            }
                        ]}
                    >
                        <div
                            ref={setRootNodeRef}
                            className={cn(
                                "border rounded-md p-2 max-h-[400px] overflow-y-auto",
                                isRootOver ? "bg-blue-500/20 border-blue-500" : "border-zinc-800"
                            )}
                        >
                            {/* Render all top-level folders first */}
                            {mapFolders
                                .filter(folder => folder.parent === null || folder.parent === "")
                                .map(folder => (
                                    <div key={folder.path}>
                                        <DroppableFolder
                                            folder={folder}
                                            level={0}
                                            isExpanded={expandedFolders.has(folder.path)}
                                            onToggle={() => toggleFolder(folder.path)}
                                            onAddSubfolder={() => {
                                                setParentFolder(folder.path);
                                                setIsCreateFolderOpen(true);
                                            }}
                                            onDelete={() => confirmDeleteFolder(folder.name)}
                                            onUpload={() => {
                                                setUploadFolder(folder.path);
                                                setIsUploadOpen(true);
                                            }}
                                        />

                                        {expandedFolders.has(folder.path) && (
                                            <>
                                                {/* Sub-folders */}
                                                {renderFolderTree(folder.path, 1)}

                                                {/* Maps in this folder */}
                                                <SortableContext
                                                    items={(mapsByFolder[folder.path] || []).map(map => map.name)}
                                                    strategy={verticalListSortingStrategy}
                                                >
                                                    {(mapsByFolder[folder.path] || []).map(map => (
                                                        <SortableMapItem
                                                            key={map.name}
                                                            map={map}
                                                            folder={folder.path}
                                                            level={1}
                                                            onSelect={(mapName) => {
                                                                console.log("Selected map:", mapName);
                                                                onMapSelect(mapName);
                                                                onClose();
                                                            }}
                                                            onRename={handleRenameMap}
                                                            onDelete={confirmDeleteMap}
                                                        />
                                                    ))}
                                                </SortableContext>
                                            </>
                                        )}
                                    </div>
                                ))}

                            {/* Root level maps */}
                            <SortableContext
                                items={(mapsByFolder['root'] || []).map(map => map.name)}
                                strategy={verticalListSortingStrategy}
                            >
                                {(mapsByFolder['root'] || []).map(map => (
                                    <SortableMapItem
                                        key={map.name}
                                        map={map}
                                        folder={null}
                                        level={0}
                                        onSelect={(mapName) => {
                                            console.log("Selected map:", mapName);
                                            onMapSelect(mapName);
                                            onClose();
                                        }}
                                        onRename={handleRenameMap}
                                        onDelete={confirmDeleteMap}
                                    />
                                ))}
                            </SortableContext>
                        </div>

                        <DragOverlayWrapper>
                            <DragOverlay
                                dropAnimation={dropAnimation}
                                style={{
                                    cursor: 'grabbing',
                                }}
                            >
                                {activeId && activeMap ? (
                                    <SortableMapItem
                                        key={activeMap.name}
                                        map={activeMap}
                                        folder={activeMap.folder ?? null}
                                        level={0}
                                        onSelect={onMapSelect}
                                        onRename={handleRenameMap}
                                        onDelete={confirmDeleteMap}
                                        dragOverlay
                                    />
                                ) : null}
                            </DragOverlay>
                        </DragOverlayWrapper>
                    </DndContext>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>

            {/* Create Folder Dialog */}
            <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Folder</DialogTitle>
                        <DialogDescription>
                            Enter a name for the new folder
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateFolder}>
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Upload Map Dialog */}
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Map</DialogTitle>
                        <DialogDescription>
                            Select a map image to upload{uploadFolder ? ` to folder: ${uploadFolder}` : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    handleUploadMap(e.target.files[0], uploadFolder);
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            {itemToDelete?.type === 'folder'
                                ? `Are you sure you want to delete the folder "${itemToDelete.name}" and all its contents?`
                                : `Are you sure you want to delete the map "${itemToDelete?.name}"?`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={executeDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}; 