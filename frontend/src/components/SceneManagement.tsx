import React, { useState, useEffect } from 'react';
import { Scene } from '../types/map';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useToast } from './ui/use-toast';
import { Folder, FolderPlus, FolderMinus, ChevronRight, ChevronDown, Map } from 'lucide-react';
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

interface SceneManagementProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (scene: Scene) => void;
    currentScene: Scene;
}

interface SortableSceneItemProps {
    scene: Scene;
    folder: string | null;
    level: number;
    onLoad: (scene: Scene) => void;
    dragOverlay?: boolean;
}

interface DroppableFolderProps {
    folder: FolderItem;
    level: number;
    isExpanded: boolean;
    onToggle: () => void;
    onAddSubfolder: () => void;
    onDelete: () => void;
}

const DroppableFolder: React.FC<DroppableFolderProps> = ({
    folder,
    level,
    isExpanded,
    onToggle,
    onAddSubfolder,
    onDelete,
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: folder.path,
        data: {
            type: 'folder',
            folderPath: folder.path,
            accepts: 'scene'
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
                        onAddSubfolder();
                    }}
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
                >
                    <FolderMinus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

const SortableSceneItem: React.FC<SortableSceneItemProps> = ({
    scene,
    folder,
    level,
    onLoad,
    dragOverlay
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: scene.id,
        data: {
            type: 'scene',
            currentFolder: folder,
            scene: scene
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

    return (
        <div
            ref={!dragOverlay ? setNodeRef : undefined}
            style={style}
            className="flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded-md cursor-move"
            {...(!dragOverlay ? { ...attributes, ...listeners } : {})}
        >
            <div className="flex items-center gap-2" style={{ marginLeft: `${level * 20}px` }}>
                <Map className="h-4 w-4 text-zinc-400" />
                <span>{scene.name}</span>
            </div>
            {!dragOverlay && (
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onLoad(scene);
                        }}
                    >
                        Load
                    </Button>
                </div>
            )}
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

export const SceneManagement: React.FC<SceneManagementProps> = ({
    isOpen,
    onClose,
    onLoad,
    currentScene
}) => {
    const { toast } = useToast();
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [parentFolder, setParentFolder] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    const [overFolder, setOverFolder] = useState<string | null>(null);

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

    const loadScenes = async () => {
        try {
            const response = await fetch('http://localhost:8010/scenes/list');
            if (!response.ok) throw new Error('Failed to load scenes');
            const data = await response.json();
            setScenes(data.scenes);
            setFolders(data.folders);
        } catch (error) {
            console.error('Error loading scenes:', error);
            toast({
                title: "Error",
                description: "Failed to load scenes. Please try again.",
                variant: "destructive",
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadScenes();
        }
    }, [isOpen]);

    const handleCreateFolder = async () => {
        try {
            const response = await fetch('http://localhost:8010/scenes/folder', {
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
            loadScenes();
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
            const response = await fetch(`http://localhost:8010/scenes/folder/${folderName}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete folder');

            toast({
                title: "Success",
                description: "Folder deleted successfully",
            });

            loadScenes();
        } catch (error) {
            console.error('Error deleting folder:', error);
            toast({
                title: "Error",
                description: "Failed to delete folder. Please try again.",
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

    const handleMoveScene = async (scene: Scene, targetFolder: string | null) => {
        try {
            const sceneToSave = {
                ...scene,
                folder: targetFolder || undefined
            };

            const response = await fetch(`http://localhost:8010/scenes/${scene.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sceneToSave),
            });

            if (!response.ok) throw new Error('Failed to move scene');

            toast({
                title: "Success",
                description: "Scene moved successfully",
            });

            loadScenes();
        } catch (error) {
            console.error('Error moving scene:', error);
            toast({
                title: "Error",
                description: "Failed to move scene. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        console.log('Drag start:', event.active.id);
        setActiveId(event.active.id as string);

        // Find the scene being dragged
        if (event.active.data.current?.type === 'scene') {
            const sceneId = event.active.id as string;
            const scene = scenes.find(s => s.id === sceneId) || null;
            setActiveScene(scene);
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
        setActiveScene(null);
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
            const sceneId = active.id as string;
            const targetScene = scenes.find(s => s.id === sceneId);

            if (targetScene) {
                // Get current folder
                const currentFolder = targetScene.folder || null;

                // Only move if target folder is different from current
                const normalizedTargetFolder = targetFolder === 'root' ? null : targetFolder;
                const shouldMove = normalizedTargetFolder !== currentFolder;

                if (shouldMove) {
                    console.log(`Moving scene ${targetScene.name} from ${currentFolder} to ${normalizedTargetFolder}`);
                    await handleMoveScene(targetScene, normalizedTargetFolder);

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
        }
        // Handle reordering within the same folder
        else if (active.id !== over.id) {
            const activeSceneFolder = scenes.find(s => s.id === active.id)?.folder || null;
            const overSceneFolder = scenes.find(s => s.id === over.id)?.folder || null;

            if (activeSceneFolder === overSceneFolder) {
                const folderScenes = scenes.filter(s => s.folder === activeSceneFolder);
                const oldIndex = folderScenes.findIndex(s => s.id === active.id);
                const newIndex = folderScenes.findIndex(s => s.id === over.id);

                if (oldIndex !== -1 && newIndex !== -1) {
                    console.log(`Reordering scene ${active.id} in folder ${activeSceneFolder}`);
                    const newScenes = [...scenes];
                    const reorderedFolderScenes = arrayMove([...folderScenes], oldIndex, newIndex);

                    // Replace old scenes with reordered ones
                    let counter = 0;
                    for (let i = 0; i < newScenes.length; i++) {
                        if (newScenes[i].folder === activeSceneFolder) {
                            newScenes[i] = reorderedFolderScenes[counter];
                            counter++;
                        }
                    }

                    setScenes(newScenes);
                    // If you have a way to save this ordering, add it here
                }
            }
        }
    };

    const renderFolderTree = (parent: string | null = null, level: number = 0) => {
        const childFolders = folders.filter(f => f.parent === (parent || ""));
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
                    onDelete={() => handleDeleteFolder(folder.name)}
                />

                {expandedFolders.has(folder.path) && (
                    <>
                        {renderFolderTree(folder.path, level + 1)}
                        <SortableContext
                            items={scenes
                                .filter(scene => scene.folder === folder.path)
                                .map(scene => scene.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {scenes
                                .filter(scene => scene.folder === folder.path)
                                .map(scene => (
                                    <SortableSceneItem
                                        key={scene.id}
                                        scene={scene}
                                        folder={folder.path}
                                        level={level + 1}
                                        onLoad={onLoad}
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
            accepts: 'scene'
        }
    });

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
                    <DialogTitle>Scene Management</DialogTitle>
                    <DialogDescription>
                        Manage your scenes and folders
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
                    </div>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <div
                            ref={setRootNodeRef}
                            className={cn(
                                "border rounded-md p-2 max-h-[400px] overflow-y-auto",
                                isRootOver ? "bg-blue-500/20 border-blue-500" : "border-zinc-800"
                            )}
                        >
                            {/* Root level scenes */}
                            <SortableContext
                                items={scenes
                                    .filter(scene => !scene.folder)
                                    .map(scene => scene.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {scenes
                                    .filter(scene => !scene.folder)
                                    .map(scene => (
                                        <SortableSceneItem
                                            key={scene.id}
                                            scene={scene}
                                            folder={null}
                                            level={0}
                                            onLoad={onLoad}
                                        />
                                    ))}
                            </SortableContext>

                            {/* Folder Tree */}
                            {renderFolderTree()}
                        </div>

                        <DragOverlayWrapper>
                            <DragOverlay
                                dropAnimation={dropAnimation}
                                style={{
                                    cursor: 'grabbing',
                                }}
                            >
                                {activeId && activeScene ? (
                                    <SortableSceneItem
                                        scene={activeScene}
                                        folder={activeScene.folder ?? null}
                                        level={0}
                                        onLoad={onLoad}
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
        </Dialog>
    );
}; 