import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

interface MoveEverythingDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onMove: (dx: number, dy: number) => void;
}

export const MoveEverythingDialog: React.FC<MoveEverythingDialogProps> = ({
    isOpen,
    onClose,
    onMove,
}) => {
    const [gridAmount, setGridAmount] = useState(1);

    const handleMove = (direction: 'up' | 'down' | 'left' | 'right') => {
        let dx = 0;
        let dy = 0;

        switch (direction) {
            case 'up':
                dy = -gridAmount;
                break;
            case 'down':
                dy = gridAmount;
                break;
            case 'left':
                dx = -gridAmount;
                break;
            case 'right':
                dx = gridAmount;
                break;
        }

        onMove(dx, dy);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Move Everything</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="gridAmount">Number of Grid Cells</Label>
                        <Input
                            id="gridAmount"
                            type="number"
                            min="1"
                            value={gridAmount}
                            onChange={(e) => setGridAmount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Direction</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <div></div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMove('up')}
                                className="flex items-center justify-center gap-1"
                            >
                                <ArrowUp className="h-4 w-4" />
                                Up
                            </Button>
                            <div></div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMove('left')}
                                className="flex items-center justify-center gap-1"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Left
                            </Button>
                            <div></div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMove('right')}
                                className="flex items-center justify-center gap-1"
                            >
                                <ArrowRight className="h-4 w-4" />
                                Right
                            </Button>

                            <div></div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMove('down')}
                                className="flex items-center justify-center gap-1"
                            >
                                <ArrowDown className="h-4 w-4" />
                                Down
                            </Button>
                            <div></div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 