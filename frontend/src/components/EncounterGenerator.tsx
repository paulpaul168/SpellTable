'use client';

import React from 'react';
import {DialogHeader, DialogTitle} from './ui/dialog';
import {Button} from "@/components/ui/button";

export function EncounterGenerator() {

    // === UI ===
    return (
        <div className="space-y-6">
            <DialogHeader>
                <DialogTitle>Encounter Generator</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
                ok
            </div>
            <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline"
                        className="border-zinc-200 dark:border-zinc-700">
                    Cancel
                </Button>
                <Button
                    className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900">
                    Create
                </Button>
            </div>
        </div>
    );
}
