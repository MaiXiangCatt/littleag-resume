import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/utils';

function Form({ className, ...props }: ComponentProps<'form'>) {
  return <form className={cn(className)} data-slot="form" {...props} />;
}

export { Form };
