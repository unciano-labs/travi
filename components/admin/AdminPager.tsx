import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AdminPagerProps {
  basePath: string;
  /** Current filters to keep in the page links (empty values are dropped). */
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}

// Server-driven pagination for admin lists (links, so it works without client state).
export default function AdminPager({ basePath, params, page, pageSize, total }: AdminPagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
    if (p > 1) search.set('page', String(p));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-border px-6 py-4 text-sm">
      <span className="font-medium text-muted-foreground">
        Showing {first.toLocaleString()} to {last.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="neutral" size="sm"><Link href={href(page - 1)}>Previous</Link></Button>
        ) : (
          <Button variant="neutral" size="sm" disabled>Previous</Button>
        )}
        {page < pages ? (
          <Button asChild variant="neutral" size="sm"><Link href={href(page + 1)}>Next</Link></Button>
        ) : (
          <Button variant="neutral" size="sm" disabled>Next</Button>
        )}
      </div>
    </nav>
  );
}
