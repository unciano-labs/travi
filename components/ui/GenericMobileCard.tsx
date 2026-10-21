import React from 'react';

export interface CardRow {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}

export interface GenericMobileCardProps {
  headerTitle?: React.ReactNode;
  headerSubtitle?: React.ReactNode;
  headerBadge?: React.ReactNode;
  rows: CardRow[];
  actions?: React.ReactNode;
  onClick?: () => void;
}

export default function GenericMobileCard({
  headerTitle,
  headerSubtitle,
  headerBadge,
  rows,
  actions,
  onClick
}: GenericMobileCardProps) {
  return (
    <div 
      className={`bg-white rounded-lg border border-border p-4 transition-colors ${onClick ? 'hover:border-primary/40 cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {(headerTitle || headerBadge || headerSubtitle) && (
        <div className="mb-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              {headerTitle && <div className="font-semibold text-foreground truncate">{headerTitle}</div>}
              {headerSubtitle && <div className="text-xs text-muted-foreground mt-1">{headerSubtitle}</div>}
            </div>
            {headerBadge && <div className="flex-shrink-0">{headerBadge}</div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
        {rows.map((row, idx) => (
          <div key={idx} className={row.fullWidth ? 'col-span-2' : 'col-span-2 sm:col-span-1'}>
            <span className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {row.label}
            </span>
            <div className="text-sm text-foreground font-medium break-words">
              {row.value}
            </div>
          </div>
        ))}
      </div>

      {actions && (
        <div className="mt-4 pt-3 border-t border-border flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
