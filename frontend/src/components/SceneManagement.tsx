import React, { useState, useEffect } from 'react';
import { Scene } from '../types/map';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useToast } from './ui/use-toast';
import { Folder, FolderPlus, FolderMinus, ChevronRight, ChevronDown, Map, Move } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
    const [sceneToMove, setSceneToMove] = useState<Scene | null>(null);

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

    const renderFolderTree = (parent: string | null = null, level: number = 0) => {
        const childFolders = folders.filter(f => f.parent === (parent || ""));
        return childFolders.map(folder => (
            <div key={folder.path} style={{ marginLeft: `${level * 20}px` }}>
                <div
                    className="flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded-md cursor-pointer"
                    onClick={() => toggleFolder(folder.path)}
                >
                    <div className="flex items-center gap-2">
                        {expandedFolders.has(folder.path) ? (
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
                                setParentFolder(folder.path);
                                setIsCreateFolderOpen(true);
                            }}
                        >
                            <FolderPlus className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.name);
                            }}
                        >
                            <FolderMinus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {expandedFolders.has(folder.path) && (
                    <>
                        {renderFolderTree(folder.path, level + 1)}
                        {scenes
                            .filter(scene => scene.folder === folder.path)
                            .map(scene => renderSceneItem(scene, folder.path, level + 1))}
                    </>
                )}
            </div>
        ));
    };

    const renderSceneItem = (scene: Scene, folder: string | null = null, level: number = 0) => (
        <div
            key={scene.id}
            className="flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded-md"
            style={{ marginLeft: `${level * 20}px` }}
        >
            <div className="flex items-center gap-2">
                <Map className="h-4 w-4 text-zinc-400" />
                <span>{scene.name}</span>
            </div>
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onLoad(scene)}
                >
                    Load
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                            <Move className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem
                            onClick={() => handleMoveScene(scene, null)}
                            className={!scene.folder ? "bg-zinc-800" : ""}
                        >
                            Root
                        </DropdownMenuItem>
                        {folders.map(f => (
                            <DropdownMenuItem
                                key={f.path}
                                onClick={() => handleMoveScene(scene, f.path)}
                                className={scene.folder === f.path ? "bg-zinc-800" : ""}
                            >
                                {f.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );

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

                    <div className="border rounded-md p-2 max-h-[400px] overflow-y-auto">
                        {/* Root level scenes */}
                        {scenes
                            .filter(scene => !scene.folder)
                            .map(scene => renderSceneItem(scene))}

                        {/* Folder Tree */}
                        {renderFolderTree()}
                    </div>
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