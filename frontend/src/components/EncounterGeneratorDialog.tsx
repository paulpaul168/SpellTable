import React from 'react';
import {Dialog, DialogContent} from "@/components/ui/dialog";
import {EncounterGenerator} from "@/components/EncounterGenerator";
import {InitiativeSidebarHandle} from "@/components/InitiativeSidebar";

interface EncounterGeneratorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initiativeSidebarRef: React.RefObject<InitiativeSidebarHandle>;
}

export const EncounterGeneratorDialog: React.FC<EncounterGeneratorDialogProps> = ({
                                                                                      isOpen,
                                                                                      onClose,
                                                                                      initiativeSidebarRef,
                                                                                  }) => {


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="max-w-7xl w-[90vw] max-h-[90vh] overflow-hidden bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 p-0">
                <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6">
                        <EncounterGenerator
                            initiativeSidebarRef={initiativeSidebarRef}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};