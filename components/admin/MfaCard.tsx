import { ShieldCheck } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import { Button } from '@/components/ui/button';
import { logoutAdmin } from '@/actions/auth';

// Full-screen card for the admin MFA steps (outside the admin shell, like /admin/login).
export default function MfaCard({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="tw-admin relative min-h-screen overflow-hidden bg-lightprimary">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <CardBox className="w-full border-none md:w-112.5">
          <div className="text-center">
            <p className="font-display text-3xl font-bold tracking-tight text-dark">
              travi<span className="text-primary">.</span>
              <span className="ml-1.5 align-middle font-dashboard text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</span>
            </p>
            <div className="mx-auto mb-3 mt-6 flex size-12 items-center justify-center rounded-full bg-lightprimary text-primary">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>

          {children}

          <form action={logoutAdmin} className="text-center">
            <Button type="submit" variant="link" size="sm">Sign out</Button>
          </form>
        </CardBox>
      </div>
    </div>
  );
}
