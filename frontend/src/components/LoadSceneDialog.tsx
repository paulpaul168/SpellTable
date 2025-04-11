import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Scene } from '../types/map';

interface LoadSceneDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (scene: Scene) => void;
    savedScenes: Scene[];
}

export const LoadSceneDialog: React.FC<LoadSceneDialogProps> = ({
    isOpen,
    onClose,
    onLoad,
    savedScenes,
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Load Scene</DialogTitle>
                    <DialogDescription>
                        Select a saved scene to load.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        {savedScenes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No saved scenes found.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {savedScenes.map((scene) => (
                                    <Button
                                        key={scene.id}
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => {
                                            onLoad(scene);
                                            onClose();
                                        }}
                                    >
                                        {scene.name}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}; 