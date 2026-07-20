import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/utils';

function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-lg border border-slate-200 bg-white text-slate-950 shadow-sm', className)} data-slot="card" {...props} />;
}

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} data-slot="card-header" {...props} />;
}

function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-2xl font-semibold leading-none tracking-normal', className)} data-slot="card-title" {...props} />;
}

function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-slate-500', className)} data-slot="card-description" {...props} />;
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-6 pt-0', className)} data-slot="card-content" {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center p-6 pt-0', className)} data-slot="card-footer" {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
