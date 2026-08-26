'use client';

import { useState } from 'react';
import { updateTransporterProfile } from '@/actions/transporter';
import { Loader2, CheckCircle2, AlertCircle, Star, Phone, Mail, Building, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

type TransporterProfile = {
  id: string;
  transporter_type: string;
  company_name: string | null;
  display_name: string;
  description: string | null;
  phone: string;
  service_areas: string[] | null;
  status: string;
  average_rating: number;
  review_count: number;
  user_profiles: {
    email: string;
  } | { email: string; }[] | null;
};

export default function TransporterProfileForm({ profile }: { profile: TransporterProfile }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [transporterType, setTransporterType] = useState(profile.transporter_type || 'individual');

  // Handle edge cases if relation returned array
  const userProfile = Array.isArray(profile.user_profiles) 
    ? profile.user_profiles[0] 
    : profile.user_profiles;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const formData = new FormData(e.currentTarget);
    const res = await updateTransporterProfile(formData);
    setLoading(false);

    if (res.success) {
      setSuccessMsg('Transporter profile updated successfully.');
      router.refresh();
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(res.error || 'Failed to update profile.');
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Top Reputation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Business Details</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage your public information and operational contact info.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-xs">
            <Star className="w-4 h-4 fill-coral text-coral" />
            <span className="font-bold text-slate-900">{Number(profile.average_rating || 5).toFixed(1)}</span>
            <span className="text-slate-400">({profile.review_count || 0})</span>
          </div>

          <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize ${
            profile.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
            profile.status === 'pending' ? 'bg-amber-100 text-amber-800' :
            'bg-red-100 text-red-800'
          }`}>
            {profile.status}
          </span>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-sm font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-800 rounded-xl border border-red-100 text-sm font-medium flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Transporter Type Radio */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Transporter Account Type
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
            transporterType === 'individual'
              ? 'border-coral bg-coral/5 text-coral ring-1 ring-coral'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}>
            <input
              type="radio"
              name="transporterType"
              value="individual"
              checked={transporterType === 'individual'}
              onChange={() => setTransporterType('individual')}
              className="sr-only"
            />
            <User className="w-5 h-5 shrink-0" />
            <div>
              <div className="text-sm font-bold">Individual Driver</div>
              <div className="text-xs text-slate-500 font-normal">Independent vehicle owner</div>
            </div>
          </label>

          <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
            transporterType === 'company'
              ? 'border-coral bg-coral/5 text-coral ring-1 ring-coral'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}>
            <input
              type="radio"
              name="transporterType"
              value="company"
              checked={transporterType === 'company'}
              onChange={() => setTransporterType('company')}
              className="sr-only"
            />
            <Building className="w-5 h-5 shrink-0" />
            <div>
              <div className="text-sm font-bold">Transport Fleet Company</div>
              <div className="text-xs text-slate-500 font-normal">Registered company with multiple vehicles</div>
            </div>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {transporterType === 'company' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Registered Company Name *
            </label>
            <input 
              type="text" 
              name="companyName"
              required={transporterType === 'company'}
              placeholder="e.g. Palawan Express Transport Co."
              defaultValue={profile.company_name || ''}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-slate-50 text-slate-900 text-sm font-medium transition-all"
            />
          </div>
        )}

        <div className={transporterType === 'individual' ? 'sm:col-span-2' : ''}>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Public Display Name *
          </label>
          <input 
            type="text" 
            name="displayName"
            required
            placeholder="e.g. Kuya John Van Rentals"
            defaultValue={profile.display_name}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-slate-50 text-slate-900 text-sm font-medium transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Business Description & Overview
        </label>
        <textarea 
          name="description"
          rows={3}
          placeholder="Briefly describe your fleet, years of experience, and service safety standards..."
          defaultValue={profile.description || ''}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-slate-50 text-slate-900 text-sm transition-all"
        />
      </div>
      
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Service Areas & Coverage
        </label>
        <input 
          type="text" 
          name="serviceAreas"
          placeholder="Cebu City, Mactan, Oslob, Moalboal"
          defaultValue={(profile.service_areas || []).join(', ')}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-slate-50 text-slate-900 text-sm transition-all"
        />
        <p className="mt-1.5 text-xs text-slate-400">Comma-separated cities or regions where you can accept trip bookings.</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Contact Email (Account)
          </label>
          <div className="relative">
            <input 
              type="email" 
              defaultValue={userProfile?.email || ''}
              disabled
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm cursor-not-allowed"
            />
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Contact Phone Number *
          </label>
          <div className="relative">
            <input 
              type="tel" 
              name="phone"
              required
              placeholder="+63 912 345 6789"
              defaultValue={profile.phone}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-slate-50 text-slate-900 text-sm transition-all"
            />
            <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>
        </div>
      </div>
      
      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button 
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-coral hover:bg-coral/90 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-coral/20 hover:shadow-lg transition-all disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Profile Changes
        </button>
      </div>
    </form>
  );
}
