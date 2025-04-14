import React, { useState, useEffect } from 'react';
import { Scene } from '../types/map';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useToast } from './ui/use-toast';
import { Folder, FolderPlus, FolderMinus, ChevronRight, ChevronDown, Map } from 'lucide-react';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../lib/utils';

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
    });

    return (
        <div
            ref={setNodeRef}
            style={{ marginLeft: `${level * 20}px` }}
            className={cn(
                "flex items-center justify-between p-2 rounded-md cursor-pointer",
                isOver ? "bg-zinc-800/80" : "hover:bg-zinc-800/50"
            )}
            onClick={onToggle}
        >
            <div className="flex items-center gap-2">
                {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                ) : (
                    <ChevronRight className="h-4 w-4" />
                )}
                <Folder className="h-4 w-4 text-zinc-400" />
                <span>{folder.name}</span>
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

const SortableSceneItem: React.FC<SortableSceneItemProps> = ({ scene, folder, level, onLoad }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: scene.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded-md cursor-move"
            {...attributes}
            {...listeners}
        >
            <div className="flex items-center gap-2" style={{ marginLeft: `${level * 20}px` }}>
                <Map className="h-4 w-4 text-zinc-400" />
                <span>{scene.name}</span>
            </div>
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
        </div>
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

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 8,
            },
            coordinateGetter: sortableKeyboardCoordinates,
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 300,
                tolerance: 5,
            },
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
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over) {
            const activeScene = scenes.find(s => s.id === active.id);
            if (activeScene) {
                const targetFolder = over.id === 'root' ? null : over.id as string;
                await handleMoveScene(activeScene, targetFolder);
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
    });

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
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div
                            ref={setRootNodeRef}
                            className={cn(
                                "border rounded-md p-2 max-h-[400px] overflow-y-auto",
                                isRootOver ? "bg-zinc-800/80" : ""
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

                        <DragOverlay
                            dropAnimation={null}
                            adjustScale={true}
                            style={{
                                position: 'fixed',
                                pointerEvents: 'none',
                                zIndex: 9999,
                            }}
                        >
                            {activeId ? (
                                <div
                                    className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-md"
                                    style={{
                                        transform: 'translate3d(-100%, -100%, 0)',
                                        willChange: 'transform',
                                        pointerEvents: 'none',
                                        transformOrigin: 'center center',
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Map className="h-4 w-4 text-zinc-400" />
                                        <span>
                                            {scenes.find(s => s.id === activeId)?.name}
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                        </DragOverlay>
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