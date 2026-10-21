import * as React from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// One colour per status value across every table in the app (see AGENTS.md §4.2 for the values).
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: 'lightWarning',
  processing: 'lightInfo',
  confirmed: 'lightSuccess',
  accepted: 'lightSuccess',
  approved: 'lightSuccess',
  published: 'lightSuccess',
  active: 'lightSuccess',
  available: 'lightSuccess',
  open: 'lightSuccess',
  paid: 'lightSuccess',
  completed: 'lightPrimary',
  booked: 'lightPrimary',
  self_provided: 'lightSecondary',
  refunded: 'lightInfo',
  resolved_refunded: 'lightInfo',
  full: 'lightWarning',
  unresolved: 'lightError',
  canceled: 'lightError',
  cancelled: 'lightError',
  rejected: 'lightError',
  declined: 'lightError',
  blocked: 'lightError',
  draft: 'gray',
  archived: 'gray',
  inactive: 'gray',
  hidden: 'gray',
  none: 'gray',
  not_required: 'gray',
  resolved_denied: 'gray',
};

interface StatusBadgeProps {
  status: string | null | undefined;
  label?: React.ReactNode;
  className?: string;
}

export default function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const key = (status || '').toLowerCase();
  return (
    <Badge variant={STATUS_VARIANTS[key] ?? 'gray'} className={cn(className)}>
      {label ?? key.replace(/_/g, ' ')}
    </Badge>
  );
}
