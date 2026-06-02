"use client";

import React, { useCallback, useEffect, useId, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import {
    isMapImageFile,
    MapUploadResult,
    summarizeUploadResults,
    uploadMaps,
} from '@/services/maps';

export interface MapUploadCompleteResult {
    filename: string;
    folder?: string;
}

interface MapUploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    targetFolder?: string | null;
    title?: string;
    description?: string;
    onComplete: (results: MapUploadCompleteResult[]) => void;
}

function collectImageFiles(fileList: FileList | File[]): File[] {
    return Array.from(fileList).filter(isMapImageFile);
}

export const MapUploadDialog: React.FC<MapUploadDialogProps> = ({
    isOpen,
    onClose,
    targetFolder = null,
    title = 'Upload Maps',
    description = 'Upload one or more image files to use as maps. Supported formats include PNG, JPG, and JPEG.',
    onComplete,
}) => {
    const inputId = useId();
    const [dragActive, setDragActive] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
    const [lastSummary, setLastSummary] = useState<string | null>(null);

    const resetState = useCallback(() => {
        setSelectedFiles([]);
        setProgress(null);
        setLastSummary(null);
        setDragActive(false);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);

    const addFiles = (files: File[]) => {
        if (files.length === 0) return;
        setSelectedFiles((prev) => {
            const names = new Set(prev.map((f) => f.name));
            const merged = [...prev];
            for (const f of files) {
                if (!names.has(f.name)) {
                    merged.push(f);
                    names.add(f.name);
                }
            }
            return merged;
        });
        setLastSummary(null);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.length) {
            addFiles(collectImageFiles(e.dataTransfer.files));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            addFiles(collectImageFiles(e.target.files));
        }
        e.target.value = '';
    };

    const removeFile = (name: string) => {
        setSelectedFiles((prev) => prev.filter((f) => f.name !== name));
    };

    const handleSubmit = async () => {
        if (selectedFiles.length === 0 || isUploading) return;

        setIsUploading(true);
        setProgress({ completed: 0, total: selectedFiles.length });
        setLastSummary(null);

        try {
            const results: MapUploadResult[] = await uploadMaps(
                selectedFiles,
                targetFolder,
                (completed, total) => setProgress({ completed, total })
            );

            const { successes, failures } = summarizeUploadResults(results);

            if (failures.length === 0) {
                setLastSummary(
                    successes.length === 1
                        ? `Uploaded ${successes[0].filename}`
                        : `Uploaded ${successes.length} maps`
                );
            } else if (successes.length === 0) {
                setLastSummary(
                    `Upload failed: ${failures.map((f) => f.filename).join(', ')}`
                );
            } else {
                setLastSummary(
                    `Uploaded ${successes.length}, failed ${failures.length}: ${failures.map((f) => f.filename).join(', ')}`
                );
            }

            if (successes.length > 0) {
                onComplete(
                    successes.map((s) => ({
                        filename: s.filename,
                        folder: s.folder || undefined,
                    }))
                );
            }

            if (failures.length === 0) {
                resetState();
                onClose();
            } else {
                const failedNames = new Set(failures.map((f) => f.filename));
                setSelectedFiles((prev) => prev.filter((f) => failedNames.has(f.name)));
            }
        } finally {
            setIsUploading(false);
            setProgress(null);
        }
    };

    const folderLabel = targetFolder ? ` to folder: ${targetFolder}` : '';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {description}
                        {targetFolder ? ` Files will be saved${folderLabel}.` : ''}
                    </DialogDescription>
                </DialogHeader>

                <Card
                    className={cn(
                        'relative border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200',
                        dragActive ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'
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
                        multiple
                        id={inputId}
                        disabled={isUploading}
                    />
                    <label htmlFor={inputId} className="cursor-pointer block">
                        <div className="space-y-2">
                            <p className="text-foreground font-medium">Drag and drop maps here</p>
                            <p className="text-sm text-muted-foreground">or click to select multiple files</p>
                        </div>
                    </label>
                </Card>

                {selectedFiles.length > 0 && (
                    <ul className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-zinc-800 p-2">
                        {selectedFiles.map((file) => (
                            <li
                                key={file.name}
                                className="flex items-center justify-between gap-2 text-sm py-1 px-1"
                            >
                                <span className="truncate" title={file.name}>
                                    {file.name}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 shrink-0"
                                    disabled={isUploading}
                                    onClick={() => removeFile(file.name)}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}

                {progress && (
                    <p className="text-sm text-muted-foreground">
                        Uploading {progress.completed} of {progress.total}…
                    </p>
                )}

                {lastSummary && (
                    <p
                        className={cn(
                            'text-sm',
                            lastSummary.startsWith('Upload failed') ? 'text-destructive' : 'text-muted-foreground'
                        )}
                    >
                        {lastSummary}
                    </p>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={isUploading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={selectedFiles.length === 0 || isUploading}
                    >
                        {isUploading
                            ? 'Uploading…'
                            : `Upload${selectedFiles.length > 0 ? ` (${selectedFiles.length})` : ''}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
