'use client';

import React from 'react';
import {Dialog, DialogContent} from './ui/dialog';
import {MonsterManagement} from "@/components/MonsterManagement";

interface MonsterManagementDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function MonsterManagementDialog({isOpen, onClose}: MonsterManagementDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent
                className="max-w-7xl w-[90vw] max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                <MonsterManagement/>
            </DialogContent>
        </Dialog>
    );
}
