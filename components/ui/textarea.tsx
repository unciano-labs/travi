import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        'border-border placeholder:text-muted-foreground/70 focus-visible:outline-0 focus-visible:border-primary aria-invalid:border-error flex min-h-16 w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
