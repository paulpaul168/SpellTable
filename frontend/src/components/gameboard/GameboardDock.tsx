'use client';

import React from 'react';
import { GameboardIconButton } from './GameboardIconButton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface GameboardDockItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

interface GameboardDockProps {
  items: GameboardDockItem[];
  className?: string;
}

export const GameboardDock: React.FC<GameboardDockProps> = ({
  items,
  className,
}) => {
  return (
    <TooltipProvider>
      <div
        className={cn(
          'glass-panel flex flex-row items-center gap-0.5 rounded-full px-1.5 py-1',
          className
        )}
      >
        {items.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <GameboardIconButton
                active={item.active}
                onClick={item.onClick}
                disabled={item.disabled}
                aria-label={item.label}
                aria-pressed={item.active}
              >
                {item.icon}
              </GameboardIconButton>
            </TooltipTrigger>
            <TooltipContent>{item.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};
