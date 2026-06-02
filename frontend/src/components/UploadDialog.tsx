"use client";

import React from 'react';
import { MapUploadDialog, MapUploadCompleteResult } from './MapUploadDialog';

interface UploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (results: MapUploadCompleteResult[]) => void | Promise<void>;
}

export const UploadDialog: React.FC<UploadDialogProps> = ({ isOpen, onClose, onUpload }) => {
    const handleComplete = async (results: MapUploadCompleteResult[]) => {
        if (results.length > 0) {
            await onUpload(results);
        }
    };

    return (
        <MapUploadDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Upload Maps"
            description="Upload one or more image files to add to the current scene."
            onComplete={handleComplete}
        />
    );
};
