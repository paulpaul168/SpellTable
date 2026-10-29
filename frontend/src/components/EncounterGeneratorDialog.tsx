'use client';

import React from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { EncounterGenerator } from '@/components/EncounterGenerator';

interface EncounterGeneratorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAddToInitiative: (
        monsters: Array<{ name: string; initiative: number; hp: number }>
    ) => void;
}

export function EncounterGeneratorDialog({
    isOpen,
    onClose,
    onAddToInitiative,
}: EncounterGeneratorDialogProps) {
    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[90vh] w-[90vw] max-w-2xl overflow-y-auto bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                <EncounterGenerator onAddToInitiative={onAddToInitiative} />
            </DialogContent>
        </Dialog>
    );
}
