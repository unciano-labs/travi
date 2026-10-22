'use client';

import { useState } from 'react';
import { loginAsAdmin } from '@/actions/auth';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminLogin() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await loginAsAdmin(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

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
              <Lock className="size-6" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Admin Login</h1>
            <p className="mt-1 text-sm text-muted-foreground">Travi SaaS Platform</p>
          </div>

          {error && (
            <Alert variant="lighterror">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-login-email">Email Address</Label>
              <Input
                id="admin-login-email"
                type="email"
                name="email"
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-login-password">Password</Label>
              <Input
                id="admin-login-password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading && <Loader2 className="animate-spin" />}
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>
        </CardBox>
      </div>
    </div>
  );
}
