'use client';

import { useState } from 'react';
import { loginUser } from '@/actions/auth';
import { LogIn } from 'lucide-react';
import Link from 'next/link';

export default function UserLogin() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await loginUser(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block font-display font-bold text-3xl text-brand-navy">
          TRAVI <span className="text-coral">Marketplace</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-slate-100">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" 
                name="email"
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
              />
            </div>


            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                name="password"
                defaultValue="password"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 bg-coral hover:bg-coral/90 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-70 mt-2"
            >
              {loading ? 'Authenticating...' : (
                <><LogIn className="w-5 h-5" /> Sign In</>
              )}
            </button>
            
            <div className="mt-6 text-center text-sm text-slate-600">
              Don't have an account?{' '}
              <Link href="/signup" className="font-medium text-coral hover:text-coral/80 transition-colors">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
