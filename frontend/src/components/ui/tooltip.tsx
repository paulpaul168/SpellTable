'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <span className="relative inline-flex">{children}</span>
    </TooltipContext.Provider>
  );
}

function TooltipTrigger({
  asChild,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { asChild?: boolean }) {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) return <>{children}</>;

  const child = React.Children.only(children) as React.ReactElement<
    React.HTMLAttributes<HTMLElement>
  >;

  const handlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      ctx.setOpen(true);
      child.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      ctx.setOpen(false);
      child.props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      ctx.setOpen(true);
      child.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      ctx.setOpen(false);
      child.props.onBlur?.(e);
    },
  };

  if (asChild && React.isValidElement(child)) {
    return React.cloneElement(child, { ...props, ...handlers });
  }

  return (
    <span {...props} {...handlers}>
      {children}
    </span>
  );
}

function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { sideOffset?: number }) {
  const ctx = React.useContext(TooltipContext);
  if (!ctx?.open) return null;

  return (
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none absolute bottom-full left-1/2 z-[10002] mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/50 bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
        className
      )}
      style={{ marginBottom: sideOffset }}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
