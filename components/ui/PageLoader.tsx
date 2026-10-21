import { Loader2 } from 'lucide-react';

export default function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[60vh] gap-4" role="status">
      <Loader2 className="w-10 h-10 text-primary animate-spin" aria-hidden="true" />
      <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
    </div>
  );
}
