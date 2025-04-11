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
import { Trash2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

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
    const { toast } = useToast();

    const handleDeleteScene = async (scene: Scene) => {
        try {
            const response = await fetch(`http://localhost:8010/scenes/${scene.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete scene');
            }

            toast({
                title: "Scene Deleted",
                description: `Scene "${scene.name}" has been deleted.`,
                duration: 3000,
            });

            // Close the dialog and reload the scenes
            onClose();
        } catch (error) {
            console.error('Error deleting scene:', error);
            toast({
                title: "Error",
                description: "Failed to delete scene. Please try again.",
                variant: "destructive",
                duration: 3000,
            });
        }
    };

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
                                    <div key={scene.id} className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            className="flex-1 justify-start"
                                            onClick={() => {
                                                onLoad(scene);
                                                onClose();
                                            }}
                                        >
                                            {scene.name}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDeleteScene(scene)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}; 