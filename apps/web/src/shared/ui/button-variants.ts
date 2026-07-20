import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-9 px-4 py-2',
        icon: 'h-9 w-9',
        lg: 'h-11 px-5',
        sm: 'h-8 px-3 text-xs',
      },
      variant: {
        default: 'bg-slate-950 text-white hover:bg-slate-800',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        ghost: 'hover:bg-slate-100 hover:text-slate-950',
        link: 'h-auto p-0 text-slate-950 underline-offset-4 hover:underline',
        outline: 'border border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50',
        secondary: 'bg-slate-100 text-slate-950 hover:bg-slate-200',
      },
    },
  },
);

export { buttonVariants };
