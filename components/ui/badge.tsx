import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium capitalize whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent text-white bg-primary',
        primary: 'border-transparent text-white bg-primary',
        secondary: 'border-transparent bg-secondary text-white',
        success: 'border-transparent bg-success text-white',
        warning: 'border-transparent bg-warning text-white',
        info: 'border-transparent bg-info text-white',
        error: 'border-transparent bg-error text-white',
        outline: 'border-primary text-primary',
        outlineSecondary: 'border-secondary text-secondary',
        outlineSuccess: 'border-success text-success',
        outlineWarning: 'border-warning text-warning',
        outlineError: 'border-error text-error',
        outlineInfo: 'border-info text-info',
        lightPrimary: 'bg-lightprimary text-primary border-transparent',
        lightSecondary: 'bg-lightsecondary text-secondary border-transparent',
        lightSuccess: 'bg-lightsuccess text-successemphasis border-transparent',
        lightError: 'bg-lighterror text-error border-transparent',
        lightInfo: 'bg-lightinfo text-info border-transparent',
        lightWarning: 'bg-lightwarning text-warningemphasis border-transparent',
        gray: 'border-transparent bg-muted text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
