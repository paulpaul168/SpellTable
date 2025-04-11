import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SaveSceneDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    currentName?: string;
}

export const SaveSceneDialog: React.FC<SaveSceneDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    currentName = '',
}) => {
    const [sceneName, setSceneName] = useState(currentName);

    const handleSave = () => {
        if (sceneName.trim()) {
            onSave(sceneName.trim());
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Save Scene</DialogTitle>
                    <DialogDescription>
                        Enter a name for your scene. This will be used to identify it later.
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
                        />
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