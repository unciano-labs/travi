'use client';

import { useState } from 'react';
import { loginAsAdmin } from '@/actions/auth';
import { Lock } from 'lucide-react';

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
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-brand-navy p-6 text-center border-b border-white/10">
          <div className="w-12 h-12 bg-coral rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Admin Login</h1>
          <p className="text-sky-300 text-sm mt-1">Travi SaaS Platform</p>
        </div>
        
        <div className="p-8">
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
                defaultValue="admin@travi.ph"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                name="password"
                defaultValue="password"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy transition-all"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-70 mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-slate-400">
            Hint: Use admin@travi.ph / password
          </div>
        </div>
      </div>
    </div>
  );
}
