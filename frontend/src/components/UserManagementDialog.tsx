'use client';

import React from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { UserManagement } from './UserManagement';

interface UserManagementDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UserManagementDialog({ isOpen, onClose }: UserManagementDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl w-[90vw] max-h-[90vh] overflow-hidden bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 p-0">
                <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6">
                        <UserManagement />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
