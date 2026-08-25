'use client';

import { useState } from 'react';
import { signupUser } from '@/actions/auth';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await signupUser(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-slate-100">
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm text-center">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
            <input 
              type="text" 
              name="firstName"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
            <input 
              type="text" 
              name="lastName"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
          <input 
            type="email" 
            name="email"
            required
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
          />
        </div>
        

        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input 
            type="password" 
            name="password"
            required
            minLength={6}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 bg-coral hover:bg-coral/90 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-70 mt-4"
        >
          {loading ? 'Creating account...' : (
            <><UserPlus className="w-5 h-5" /> Sign Up</>
          )}
        </button>
        
        <div className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-coral hover:text-coral/80 transition-colors">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
