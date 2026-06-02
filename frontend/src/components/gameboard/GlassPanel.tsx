'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type GlassPanelEdge = 'left' | 'right' | 'bottom-left' | 'bottom-right';

const edgeClasses: Record<GlassPanelEdge, string> = {
  left: 'fixed bottom-0 left-0 rounded-tr-lg animate-in slide-in-from-left duration-200',
  right: 'fixed top-0 right-0 rounded-tl-lg animate-in slide-in-from-right duration-200',
  'bottom-left': 'fixed bottom-0 left-0 rounded-tr-lg animate-in slide-in-from-left duration-200',
  'bottom-right': 'fixed top-0 right-0 rounded-tl-lg animate-in slide-in-from-right duration-200',
};

interface GlassPanelProps {
  title: string;
  onClose?: () => void;
  edge?: GlassPanelEdge;
  className?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  title,
  onClose,
  edge = 'right',
  className,
  headerActions,
  children,
  footer,
}) => {
  return (
    <div
      className={cn(
        'glass-panel z-[1000] flex w-80 min-h-[200px] max-h-[80%] flex-col',
        edgeClasses[edge],
        className
      )}
    >
      <div className="glass-panel-header flex shrink-0 items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <div className="flex items-center gap-1">
          {headerActions}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="glass-panel-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-border/50 p-2">{footer}</div>
      ) : null}
    </div>
  );
};
