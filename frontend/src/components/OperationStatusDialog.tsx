import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from 'lucide-react';

interface OperationStatusDialogProps {
    isOpen: boolean;
    onClose: () => void;
    status: 'success' | 'error';
    message: string;
}

export const OperationStatusDialog: React.FC<OperationStatusDialogProps> = ({
    isOpen,
    onClose,
    status,
    message
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {status === 'success' ? (
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        {status === 'success' ? 'Success' : 'Error'}
                    </DialogTitle>
                    <DialogDescription>
                        {message}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end">
                    <Button onClick={onClose}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}; 