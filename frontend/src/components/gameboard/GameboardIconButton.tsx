'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GameboardIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: React.ReactNode;
}

export const GameboardIconButton = React.forwardRef<
  HTMLButtonElement,
  GameboardIconButtonProps
>(({ active, className, children, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-9 w-9 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-accent/30 ring-2 ring-primary/50',
        className
      )}
      data-active={active ? '' : undefined}
      {...props}
    >
      {children}
    </Button>
  );
});
GameboardIconButton.displayName = 'GameboardIconButton';
