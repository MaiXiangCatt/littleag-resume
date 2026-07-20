import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/utils';

function Alert({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('relative w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700', className)}
      data-slot="alert"
      role="alert"
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('text-sm leading-5', className)} data-slot="alert-description" {...props} />;
}

export { Alert, AlertDescription };
