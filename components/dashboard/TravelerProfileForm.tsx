'use client';

import { useState } from 'react';

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
};

export default function TravelerProfileForm({ profile }: { profile: Profile }) {
  const [loading, setLoading] = useState(false);
  
  // Basic split for first/last name
  const names = profile.full_name ? profile.full_name.split(' ') : ['', ''];
  const defaultFirstName = names[0] || '';
  const defaultLastName = names.slice(1).join(' ') || '';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // TODO: Implement save profile action
    setTimeout(() => setLoading(false), 1000);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
          <input 
            type="text" 
            name="firstName"
            defaultValue={defaultFirstName}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
          <input 
            type="text" 
            name="lastName"
            defaultValue={defaultLastName}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-white"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
        <input 
          type="email" 
          defaultValue={profile.email}
          disabled
          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500"
        />
      </div>
      
      <div className="pt-4 border-t border-slate-100">
        <button 
          type="submit"
          disabled={loading}
          className="bg-coral text-white px-5 py-2.5 rounded-lg font-medium hover:bg-coral/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
}
