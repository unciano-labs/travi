'use client';

import { useState } from 'react';
import { updatePlatformSettings } from '@/actions/admin';
import { Loader2 } from 'lucide-react';

export function PlatformSettingsForm({ initialSettings }: { initialSettings: any }) {
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    organizer_fee_percent: initialSettings?.organizer_fee_percent || 3,
    transporter_fee_percent: initialSettings?.transporter_fee_percent || 3,
    escrow_holding_days: initialSettings?.escrow_holding_days || 3,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: Number(e.target.value) }));
    setSuccess(false);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');
    setSuccess(false);

    const res = await updatePlatformSettings(formData);
    if (res.success) {
      setSuccess(true);
    } else {
      setErrorMsg(res.error || 'Failed to update settings');
    }
    setIsSaving(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
      <h2 className="text-lg font-medium text-slate-900 mb-1">Billing & Escrow Settings</h2>
      <p className="text-sm text-slate-500 mb-6">Manage global platform fees and payment hold periods.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Organizer Fee (%)</label>
            <input 
              type="number" 
              name="organizer_fee_percent"
              step="0.1"
              min="0"
              max="100"
              value={formData.organizer_fee_percent}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
            <p className="text-xs text-slate-500 mt-1">Platform fee applied to organizers on tours.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transporter Fee (%)</label>
            <input 
              type="number" 
              name="transporter_fee_percent"
              step="0.1"
              min="0"
              max="100"
              value={formData.transporter_fee_percent}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
            <p className="text-xs text-slate-500 mt-1">Platform fee applied to independent transporters.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Escrow Holding Period (Days)</label>
            <input 
              type="number" 
              name="escrow_holding_days"
              min="0"
              value={formData.escrow_holding_days}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
            <p className="text-xs text-slate-500 mt-1">Days after tour completion before funds clear.</p>
          </div>
        </div>

        {errorMsg && <div className="text-red-500 text-sm font-medium">{errorMsg}</div>}
        {success && <div className="text-emerald-600 text-sm font-medium">Settings updated successfully!</div>}

        <button 
          type="submit" 
          disabled={isSaving}
          className="inline-flex items-center justify-center bg-brand-navy text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
        >
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Settings
        </button>
      </form>
    </div>
  );
}
