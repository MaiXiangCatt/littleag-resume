import type { AnchorHTMLAttributes } from 'react';

import { cn } from '@/shared/lib/utils';

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement>;

function Link({ className, ...props }: LinkProps) {
  return (
    <a
      className={cn('rounded-sm text-slate-950 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2', className)}
      data-slot="link"
      {...props}
    />
  );
}

export { Link };
