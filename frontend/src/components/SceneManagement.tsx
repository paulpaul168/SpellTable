'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scene, SceneImage } from '@/types/map';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from './ui/dialog';
import { useToast } from './ui/use-toast';
import { authService } from '@/services/auth';
import {
    Folder,
    FolderPlus,
    FolderMinus,
    ChevronRight,
    ChevronDown,
    Map,
    Trash,
    Pencil,
    Search,
    ImagePlus,
    GripVertical,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { getApiUrl } from '@/utils/api';

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
    onCurrentSceneImagesChange?: (images: SceneImage[]) => void;
}

interface SortableSceneItemProps {
    scene: Scene;
    folder: string | null;
    level: number;
    isCurrent: boolean;
    onLoad: (scene: Scene) => void;
    dragOverlay?: boolean;
    onDelete: () => void;
    onRename: () => void;
}

interface DroppableFolderProps {
    folder: FolderItem;
    level: number;
    isExpanded: boolean;
    onToggle: () => void;
    onAddSubfolder: () => void;
    onDelete: () => void;
    onRename: () => void;
}

function authHeaders(json = true): HeadersInit {
    return {
        ...authService.getAuthHeader(),
        ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
}

function sceneFolderKey(folder: string | null | undefined): string | null {
    return folder || null;
}

function sortScenes(list: Scene[]): Scene[] {
    return [...list].sort((a, b) => {
        const ao = a.sortOrder ?? 0;
        const bo = b.sortOrder ?? 0;
        if (ao !== bo) return ao - bo;
        return (a.name || '').localeCompare(b.name || '');
    });
}

function ancestorPaths(folderPath: string | undefined | null): string[] {
    if (!folderPath) return [];
    const parts = folderPath.split('/').filter(Boolean);
    const paths: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        paths.push(parts.slice(0, i + 1).join('/'));
    }
    return paths;
}

const DroppableFolder: React.FC<DroppableFolderProps> = ({
    folder,
    level,
    isExpanded,
    onToggle,
    onAddSubfolder,
    onDelete,
    onRename,
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: folder.path,
        data: {
            type: 'folder',
            folderPath: folder.path,
            accepts: 'scene',
        },
    });

    return (
        <div
            ref={setNodeRef}
            style={{ marginLeft: `${level * 16}px` }}
            className={cn(
                'flex items-center justify-between p-2 rounded-md mb-1 cursor-pointer',
                isOver ? 'bg-primary/20 border border-primary' : 'hover:bg-muted/50'
            )}
            onClick={onToggle}
        >
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{folder.name}</span>
            </div>
            <div className="flex gap-1 shrink-0">
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
                        onRename();
                    }}
                >
                    <Pencil className="h-4 w-4" />
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
    isCurrent,
    onLoad,
    dragOverlay,
    onDelete,
    onRename,
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
            scene,
        },
    });

    const style = dragOverlay
        ? { opacity: 0.8 }
        : {
              transform: CSS.Transform.toString(transform),
              transition,
              opacity: isDragging ? 0.5 : 1,
          };

    return (
        <div
            ref={!dragOverlay ? setNodeRef : undefined}
            style={style}
            className={cn(
                'flex items-center justify-between gap-2 p-2 rounded-md',
                isCurrent && 'bg-primary/15 ring-1 ring-primary/40',
                !isCurrent && 'hover:bg-muted/50'
            )}
        >
            <div
                className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                style={{ marginLeft: `${level * 16}px` }}
                onClick={() => onLoad(scene)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onLoad(scene);
                    }
                }}
                role="button"
                tabIndex={0}
                title="Click to load"
            >
                {!dragOverlay && (
                    <button
                        type="button"
                        className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="Drag to reorder or move"
                        onClick={(e) => e.stopPropagation()}
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                )}
                <Map className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{scene.name}</span>
                {isCurrent && (
                    <span className="text-[10px] uppercase tracking-wide text-primary shrink-0">
                        Active
                    </span>
                )}
            </div>
            {!dragOverlay && (
                <div className="flex gap-1 shrink-0">
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
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRename();
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <Trash className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
};

const DragOverlayWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    createPortal(
        <div
            style={{
                position: 'fixed',
                pointerEvents: 'none',
                zIndex: 999,
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
            }}
        >
            {children}
        </div>,
        document.body
    );

function RootDropZone({
    children,
    isLoading,
    isEmpty,
    emptyMessage,
}: {
    children: React.ReactNode;
    isLoading: boolean;
    isEmpty: boolean;
    emptyMessage: string;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'root',
        data: { type: 'folder', folderPath: 'root', accepts: 'scene' },
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'border rounded-md p-2 max-h-[360px] overflow-y-auto',
                isOver ? 'bg-primary/10 border-primary' : 'border-border'
            )}
        >
            {isLoading ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Loading…</p>
            ) : isEmpty ? (
                <p className="p-4 text-sm text-muted-foreground text-center">{emptyMessage}</p>
            ) : (
                children
            )}
        </div>
    );
}

function AuthenticatedThumb({ path, alt }: { path: string; alt: string }) {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch(
                    `${getApiUrl()}/scenes/image/${encodeURI(path)}`,
                    { headers: { ...authService.getAuthHeader() } }
                );
                if (!response.ok) return;
                const blob = await response.blob();
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setSrc(objectUrl);
            } catch (error) {
                console.error('Failed to load scene image', error);
            }
        };

        void load();
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [path]);

    if (!src) {
        return <div className="h-20 w-full bg-muted/50" />;
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-20 w-full object-cover" />
    );
}

function SceneImagesPanel({
    scene,
    onImagesChange,
}: {
    scene: Scene;
    onImagesChange?: (images: SceneImage[]) => void;
}) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [images, setImages] = useState<SceneImage[]>(scene.images || []);
    const [isUploading, setIsUploading] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<SceneImage | null>(null);
    const canManage = Boolean(scene.id && scene.id !== 'default');

    useEffect(() => {
        setImages(scene.images || []);
    }, [scene.id, scene.images]);

    const handleUpload = async (file: File) => {
        if (!canManage) return;
        setIsUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const response = await fetch(`${getApiUrl()}/scenes/${scene.id}/image`, {
                method: 'POST',
                headers: { ...authService.getAuthHeader() },
                body: form,
            });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            const next: SceneImage[] = [
                ...images,
                {
                    id: data.image_id,
                    name: data.name || file.name,
                    path: data.path,
                },
            ];
            setImages(next);
            onImagesChange?.(next);
            toast({ title: 'Image uploaded', description: file.name });
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to upload image',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async () => {
        if (!imageToDelete || !canManage) return;
        try {
            const response = await fetch(
                `${getApiUrl()}/scenes/${scene.id}/image/${imageToDelete.id}`,
                {
                    method: 'DELETE',
                    headers: authHeaders(false),
                }
            );
            if (!response.ok) throw new Error('Delete failed');
            const next = images.filter((img) => img.id !== imageToDelete.id);
            setImages(next);
            onImagesChange?.(next);
            setImageToDelete(null);
            toast({ title: 'Image deleted' });
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to delete image',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="border rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-medium">Scene images</p>
                    <p className="text-xs text-muted-foreground">
                        {canManage
                            ? `Attached to “${scene.name}”`
                            : 'Save the scene to the library to attach images'}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={!canManage || isUploading}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <ImagePlus className="h-4 w-4" />
                    {isUploading ? 'Uploading…' : 'Upload'}
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload(file);
                    }}
                />
            </div>
            {images.length === 0 ? (
                <p className="text-xs text-muted-foreground">No images yet.</p>
            ) : (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {images.map((img) => (
                        <li
                            key={img.id}
                            className="group relative overflow-hidden rounded-md border bg-muted/30"
                        >
                            <AuthenticatedThumb path={img.path} alt={img.name} />
                            <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                                <span className="truncate text-[10px]">{img.name}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    disabled={!canManage}
                                    onClick={() => setImageToDelete(img)}
                                >
                                    <Trash className="h-3 w-3" />
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <Dialog
                open={Boolean(imageToDelete)}
                onOpenChange={(open) => !open && setImageToDelete(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete image</DialogTitle>
                        <DialogDescription>
                            Delete “{imageToDelete?.name}”? This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setImageToDelete(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => void handleDelete()}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export const SceneManagement: React.FC<SceneManagementProps> = ({
    isOpen,
    onClose,
    onLoad,
    currentScene,
    onCurrentSceneImagesChange,
}) => {
    const { toast } = useToast();
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [parentFolder, setParentFolder] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    const [, setOverFolder] = useState<string | null>(null);

    const [isDeleteFolderDialogOpen, setIsDeleteFolderDialogOpen] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
    const [isDeleteSceneDialogOpen, setIsDeleteSceneDialogOpen] = useState(false);
    const [sceneToDelete, setSceneToDelete] = useState<Scene | null>(null);
    const [isRenameFolderDialogOpen, setIsRenameFolderDialogOpen] = useState(false);
    const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
    const [newRenameFolderName, setNewRenameFolderName] = useState('');
    const [isRenameSceneDialogOpen, setIsRenameSceneDialogOpen] = useState(false);
    const [sceneToRename, setSceneToRename] = useState<Scene | null>(null);
    const [newRenameSceneName, setNewRenameSceneName] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const loadScenes = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${getApiUrl()}/scenes/list`, {
                headers: authHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch scenes');
            const data = await response.json();
            const scenesData = Array.isArray(data) ? data : data.scenes || [];
            const foldersData = data.folders || [];
            setScenes(sortScenes(scenesData));
            setFolders(foldersData);
        } catch (error) {
            console.error('Error loading scenes:', error);
            toast({
                title: 'Error',
                description: 'Failed to load scenes',
                variant: 'destructive',
            });
            setScenes([]);
            setFolders([]);
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!isOpen) return;
        void loadScenes();
        setSearchQuery('');
        setExpandedFolders(new Set(ancestorPaths(currentScene.folder)));
    }, [isOpen, currentScene.folder, loadScenes]);

    const query = searchQuery.trim().toLowerCase();

    const filteredFolders = useMemo(() => {
        if (!query) return folders;
        const matchingSceneFolders = new Set(
            scenes
                .filter((s) => s.name.toLowerCase().includes(query))
                .map((s) => s.folder)
                .filter(Boolean) as string[]
        );
        return folders.filter((f) => {
            if (f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query)) {
                return true;
            }
            return [...matchingSceneFolders].some(
                (path) => path === f.path || path.startsWith(f.path + '/')
            );
        });
    }, [folders, scenes, query]);

    const filteredScenes = useMemo(() => {
        if (!query) return scenes;
        return scenes.filter((s) => s.name.toLowerCase().includes(query));
    }, [scenes, query]);

    useEffect(() => {
        if (!query) return;
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            for (const scene of filteredScenes) {
                for (const path of ancestorPaths(scene.folder)) {
                    next.add(path);
                }
            }
            for (const folder of filteredFolders) {
                next.add(folder.path);
                for (const path of ancestorPaths(folder.parent)) {
                    next.add(path);
                }
            }
            return next;
        });
    }, [query, filteredScenes, filteredFolders]);

    const handleCreateFolder = async () => {
        try {
            const response = await fetch(`${getApiUrl()}/scenes/folder`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    folder_name: newFolderName,
                    parent_folder: parentFolder || undefined,
                }),
            });
            if (!response.ok) throw new Error('Failed to create folder');
            toast({ title: 'Success', description: 'Folder created successfully' });
            setNewFolderName('');
            setParentFolder(null);
            setIsCreateFolderOpen(false);
            void loadScenes();
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to create folder. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleDeleteFolder = async () => {
        if (!folderToDelete) return;
        try {
            const response = await fetch(
                `${getApiUrl()}/scenes/folder/${folderToDelete.path}`,
                { method: 'DELETE', headers: authHeaders(false) }
            );
            if (!response.ok) throw new Error('Failed to delete folder');
            toast({ title: 'Success', description: 'Folder deleted successfully' });
            setIsDeleteFolderDialogOpen(false);
            setFolderToDelete(null);
            void loadScenes();
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to delete folder. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleDeleteScene = async () => {
        if (!sceneToDelete) return;
        try {
            const response = await fetch(`${getApiUrl()}/scenes/${sceneToDelete.id}`, {
                method: 'DELETE',
                headers: authHeaders(false),
            });
            if (!response.ok) throw new Error('Failed to delete scene');
            toast({ title: 'Success', description: 'Scene deleted successfully' });
            setIsDeleteSceneDialogOpen(false);
            setSceneToDelete(null);
            void loadScenes();
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to delete scene. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleRenameFolder = async () => {
        if (!folderToRename || !newRenameFolderName.trim()) return;
        try {
            const response = await fetch(
                `${getApiUrl()}/scenes/folder/${folderToRename.path}`,
                {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ new_name: newRenameFolderName }),
                }
            );
            if (!response.ok) throw new Error('Failed to rename folder');
            toast({ title: 'Success', description: 'Folder renamed successfully' });
            setIsRenameFolderDialogOpen(false);
            setFolderToRename(null);
            setNewRenameFolderName('');
            void loadScenes();
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to rename folder. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleRenameScene = async () => {
        if (!sceneToRename || !newRenameSceneName.trim()) return;
        try {
            const updatedScene = { ...sceneToRename, name: newRenameSceneName };
            const response = await fetch(`${getApiUrl()}/scenes/${sceneToRename.id}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(updatedScene),
            });
            if (!response.ok) throw new Error('Failed to rename scene');
            toast({ title: 'Success', description: 'Scene renamed successfully' });
            setIsRenameSceneDialogOpen(false);
            setSceneToRename(null);
            setNewRenameSceneName('');
            void loadScenes();
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to rename scene. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleMoveScene = async (scene: Scene, targetFolder: string | null) => {
        try {
            const sceneToSave = {
                ...scene,
                folder: targetFolder || undefined,
            };
            const response = await fetch(`${getApiUrl()}/scenes/${scene.id}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(sceneToSave),
            });
            if (!response.ok) throw new Error('Failed to move scene');
            toast({ title: 'Success', description: 'Scene moved successfully' });
            void loadScenes();
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to move scene. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const persistFolderOrder = async (ordered: Scene[], folder: string | null) => {
        const withOrder = ordered.map((s, index) => ({
            ...s,
            sortOrder: index,
            folder: folder || undefined,
        }));
        setScenes((prev) => {
            const others = prev.filter(
                (s) => sceneFolderKey(s.folder) !== folder
            );
            return sortScenes([...others, ...withOrder]);
        });
        try {
            await Promise.all(
                withOrder.map((s) =>
                    fetch(`${getApiUrl()}/scenes/${s.id}`, {
                        method: 'PUT',
                        headers: authHeaders(),
                        body: JSON.stringify(s),
                    }).then((res) => {
                        if (!res.ok) throw new Error(`Failed to update ${s.id}`);
                    })
                )
            );
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to save scene order. Reloading…',
                variant: 'destructive',
            });
            void loadScenes();
        }
    };

    const toggleFolder = (folderName: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderName)) next.delete(folderName);
            else next.add(folderName);
            return next;
        });
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        if (event.active.data.current?.type === 'scene') {
            setActiveScene(scenes.find((s) => s.id === event.active.id) || null);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        if (over && over.data.current?.type === 'folder') {
            setOverFolder(over.id as string);
        } else {
            setOverFolder(null);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveScene(null);
        setOverFolder(null);
        if (!over || active.id === over.id) return;

        const overData = over.data.current;

        if (overData?.type === 'folder') {
            const targetScene = scenes.find((s) => s.id === active.id);
            if (!targetScene) return;
            const normalizedTargetFolder =
                (over.id as string) === 'root' ? null : (over.id as string);
            if (normalizedTargetFolder !== sceneFolderKey(targetScene.folder)) {
                await handleMoveScene(targetScene, normalizedTargetFolder);
                if (normalizedTargetFolder) {
                    setExpandedFolders((prev) => new Set(prev).add(normalizedTargetFolder));
                }
            }
            return;
        }

        const activeFolder =
            sceneFolderKey(scenes.find((s) => s.id === active.id)?.folder) ?? null;
        const overFolderKey =
            sceneFolderKey(scenes.find((s) => s.id === over.id)?.folder) ?? null;
        if (activeFolder !== overFolderKey) return;

        const folderScenes = sortScenes(
            scenes.filter((s) => sceneFolderKey(s.folder) === activeFolder)
        );
        const oldIndex = folderScenes.findIndex((s) => s.id === active.id);
        const newIndex = folderScenes.findIndex((s) => s.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(folderScenes, oldIndex, newIndex);
        await persistFolderOrder(reordered, activeFolder);
    };

    const renderFolderTree = (parent: string | null = null, level = 0) => {
        const childFolders = filteredFolders.filter(
            (f) => f.parent === (parent || '')
        );
        return childFolders.map((folder) => (
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
                    onDelete={() => {
                        setFolderToDelete(folder);
                        setIsDeleteFolderDialogOpen(true);
                    }}
                    onRename={() => {
                        setFolderToRename(folder);
                        setNewRenameFolderName(folder.name);
                        setIsRenameFolderDialogOpen(true);
                    }}
                />
                {expandedFolders.has(folder.path) && (
                    <>
                        {renderFolderTree(folder.path, level + 1)}
                        <SortableContext
                            items={sortScenes(
                                filteredScenes.filter((s) => s.folder === folder.path)
                            ).map((s) => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {sortScenes(
                                filteredScenes.filter((s) => s.folder === folder.path)
                            ).map((scene) => (
                                <SortableSceneItem
                                    key={scene.id}
                                    scene={scene}
                                    folder={folder.path}
                                    level={level + 1}
                                    isCurrent={scene.id === currentScene.id}
                                    onLoad={onLoad}
                                    onDelete={() => {
                                        setSceneToDelete(scene);
                                        setIsDeleteSceneDialogOpen(true);
                                    }}
                                    onRename={() => {
                                        setSceneToRename(scene);
                                        setNewRenameSceneName(scene.name);
                                        setIsRenameSceneDialogOpen(true);
                                    }}
                                />
                            ))}
                        </SortableContext>
                    </>
                )}
            </div>
        ));
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: '0.5' } },
        }),
    };

    const rootScenes = sortScenes(filteredScenes.filter((s) => !s.folder));

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Scene Management</DialogTitle>
                    <DialogDescription>
                        Search, organize, and load scenes. Click a name to load.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search scenes…"
                                className="pl-8"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setParentFolder(null);
                                setIsCreateFolderOpen(true);
                            }}
                            className="gap-2 shrink-0"
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
                        onDragEnd={(e) => void handleDragEnd(e)}
                    >
                        <RootDropZone
                            isLoading={isLoading}
                            emptyMessage={query ? 'No matching scenes' : 'No scenes yet'}
                            isEmpty={rootScenes.length === 0 && filteredFolders.length === 0}
                        >
                            <SortableContext
                                items={rootScenes.map((s) => s.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {rootScenes.map((scene) => (
                                    <SortableSceneItem
                                        key={scene.id}
                                        scene={scene}
                                        folder={null}
                                        level={0}
                                        isCurrent={scene.id === currentScene.id}
                                        onLoad={onLoad}
                                        onDelete={() => {
                                            setSceneToDelete(scene);
                                            setIsDeleteSceneDialogOpen(true);
                                        }}
                                        onRename={() => {
                                            setSceneToRename(scene);
                                            setNewRenameSceneName(scene.name);
                                            setIsRenameSceneDialogOpen(true);
                                        }}
                                    />
                                ))}
                            </SortableContext>
                            {renderFolderTree()}
                        </RootDropZone>

                        <DragOverlayWrapper>
                            <DragOverlay dropAnimation={dropAnimation}>
                                {activeId && activeScene ? (
                                    <SortableSceneItem
                                        scene={activeScene}
                                        folder={activeScene.folder ?? null}
                                        level={0}
                                        isCurrent={activeScene.id === currentScene.id}
                                        onLoad={onLoad}
                                        onDelete={() => {}}
                                        onRename={() => {}}
                                        dragOverlay
                                    />
                                ) : null}
                            </DragOverlay>
                        </DragOverlayWrapper>
                    </DndContext>

                    <SceneImagesPanel
                        scene={currentScene}
                        onImagesChange={onCurrentSceneImagesChange}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>

            <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Folder</DialogTitle>
                        <DialogDescription>Enter a name for the new folder</DialogDescription>
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
                        <Button onClick={() => void handleCreateFolder()}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteFolderDialogOpen} onOpenChange={setIsDeleteFolderDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Folder</DialogTitle>
                        <DialogDescription>
                            Delete folder “{folderToDelete?.name}” and all scenes inside? This
                            cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteFolderDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => void handleDeleteFolder()}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteSceneDialogOpen} onOpenChange={setIsDeleteSceneDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Scene</DialogTitle>
                        <DialogDescription>
                            Delete scene “{sceneToDelete?.name}”? This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteSceneDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => void handleDeleteScene()}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRenameFolderDialogOpen} onOpenChange={setIsRenameFolderDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Folder</DialogTitle>
                        <DialogDescription>
                            Enter a new name for “{folderToRename?.name}”
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={newRenameFolderName}
                        onChange={(e) => setNewRenameFolderName(e.target.value)}
                        placeholder="New folder name"
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsRenameFolderDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={() => void handleRenameFolder()}>Rename</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRenameSceneDialogOpen} onOpenChange={setIsRenameSceneDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Scene</DialogTitle>
                        <DialogDescription>
                            Enter a new name for “{sceneToRename?.name}”
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={newRenameSceneName}
                        onChange={(e) => setNewRenameSceneName(e.target.value)}
                        placeholder="New scene name"
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsRenameSceneDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={() => void handleRenameScene()}>Rename</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
};
