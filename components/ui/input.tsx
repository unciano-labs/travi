import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  'flex h-10 w-full border rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:rounded-sm file:text-sm file:font-medium file:text-primary file:mr-5 focus-visible:outline-0',
  {
    variants: {
      variant: {
        default:
          'border-border bg-transparent text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-0',
        failure: 'border-error bg-error/5 text-error placeholder:text-error/60 focus-visible:border-error',
        success: 'border-success bg-success/5 text-foreground focus-visible:border-success',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', variant, ...props }, ref) => {
  return <input type={type} data-slot="input" className={cn(inputVariants({ variant }), className)} ref={ref} {...props} />;
});
Input.displayName = 'Input';

// Native <select> styled like the template's inputs. Works with FormData and existing onChange handlers.
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        data-slot="native-select"
        className={cn(
          "flex h-10 w-full appearance-none rounded-lg border border-border bg-transparent bg-[url(\"data:image/svg+xml,%3csvg aria-hidden='true' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 10 6'%3e %3cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m1 1 4 4 4-4'/%3e %3c/svg%3e\")] bg-[length:0.75em_0.75em] bg-[position:right_0.75rem_center] bg-no-repeat py-2 pl-3 pr-9 text-sm text-foreground focus-visible:border-primary focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
NativeSelect.displayName = 'NativeSelect';

export { Input, NativeSelect, inputVariants };
