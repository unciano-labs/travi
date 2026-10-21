import * as React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// The template's flat, bordered card. The default container for every dashboard panel.
export default function CardBox({ className, ...props }: React.ComponentProps<'div'>) {
  return <Card className={cn('shadow-none border border-border rounded-lg w-full', className)} {...props} />;
}
