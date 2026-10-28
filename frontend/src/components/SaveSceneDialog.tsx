'use client';

import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth';
import { getApiUrl } from '@/utils/api';

interface FolderItem {
    name: string;
    type: 'folder';
    path: string;
    parent: string;
}

interface SaveSceneDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, isSaveAs: boolean, folder?: string | null) => void;
    currentName?: string;
    currentFolder?: string | null;
}

export const SaveSceneDialog: React.FC<SaveSceneDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    currentName = '',
    currentFolder = null,
}) => {
    const [sceneName, setSceneName] = useState(currentName);
    const [folder, setFolder] = useState<string>('');
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [isLoadingFolders, setIsLoadingFolders] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setSceneName(currentName);
        setFolder(currentFolder || '');

        const loadFolders = async () => {
            setIsLoadingFolders(true);
            try {
                const response = await fetch(`${getApiUrl()}/scenes/list`, {
                    headers: {
                        ...authService.getAuthHeader(),
                        'Content-Type': 'application/json',
                    },
                });
                if (!response.ok) return;
                const data = await response.json();
                setFolders(data.folders || []);
            } catch (error) {
                console.error('Error loading folders for Save As:', error);
                setFolders([]);
            } finally {
                setIsLoadingFolders(false);
            }
        };

        void loadFolders();
    }, [isOpen, currentName, currentFolder]);

    const handleSave = () => {
        if (sceneName.trim()) {
            onSave(sceneName.trim(), true, folder || null);
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Save Scene As</DialogTitle>
                    <DialogDescription>
                        Enter a name for your scene. Optionally place it in a folder.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="scene-name">Scene Name</Label>
                        <Input
                            id="scene-name"
                            value={sceneName}
                            onChange={(e) => setSceneName(e.target.value)}
                            placeholder="Enter scene name"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                            }}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="scene-folder">Folder</Label>
                        <select
                            id="scene-folder"
                            value={folder}
                            onChange={(e) => setFolder(e.target.value)}
                            disabled={isLoadingFolders}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">Root (no folder)</option>
                            {folders.map((f) => (
                                <option key={f.path} value={f.path}>
                                    {f.path}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!sceneName.trim()}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
