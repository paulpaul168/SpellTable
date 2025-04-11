import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File) => void;
}

export const UploadDialog: React.FC<UploadDialogProps> = ({ isOpen, onClose, onUpload }) => {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                setSelectedFile(file);
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (selectedFile) {
            try {
                setIsUploading(true);
                await onUpload(selectedFile);
                setSelectedFile(null);
                onClose();
            } catch (error) {
                console.error('Error uploading file:', error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Upload Map</DialogTitle>
                </DialogHeader>

                <Card
                    className={cn(
                        "relative border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200",
                        dragActive ? "border-primary bg-primary/10" : "border-muted hover:border-primary/50",
                        selectedFile ? "bg-primary/5 border-primary/50" : ""
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        className="hidden"
                        onChange={handleFileSelect}
                        accept="image/*"
                        id="map-upload"
                    />
                    <label htmlFor="map-upload" className="cursor-pointer block">
                        {selectedFile ? (
                            <div className="space-y-2">
                                <p className="text-primary font-medium">{selectedFile.name}</p>
                                <p className="text-sm text-muted-foreground">Click to change file</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-foreground font-medium">Drag and drop your map here</p>
                                <p className="text-sm text-muted-foreground">or click to select</p>
                                <p className="text-xs text-muted-foreground mt-2">Supported formats: PNG, JPG, JPEG</p>
                            </div>
                        )}
                    </label>
                </Card>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedFile || isUploading}
                    >
                        {isUploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 