'use client';

import { useState } from 'react';
import { updatePlatformSettings } from '@/actions/admin';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PlatformSettingsForm({ initialSettings }: { initialSettings: any }) {
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    // ?? not ||: a stored 0 is a real value. Defaults mirror the database column defaults.
    organizer_fee_percent: Number(initialSettings?.organizer_fee_percent ?? 10),
    transporter_fee_percent: Number(initialSettings?.transporter_fee_percent ?? 3),
    escrow_holding_days: Number(initialSettings?.escrow_holding_days ?? 3),
    min_payout_amount: Number(initialSettings?.min_payout_amount ?? 100),
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
    <CardBox className="h-full">
      <div>
        <h5 className="card-title">Billing & Escrow Settings</h5>
        <p className="text-sm text-muted-foreground">Manage global platform fees and payment hold periods.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="organizer_fee_percent">Organizer Fee (%)</Label>
            <Input
              id="organizer_fee_percent"
              type="number"
              name="organizer_fee_percent"
              step="0.1"
              min="0"
              max="50"
              value={formData.organizer_fee_percent}
              onChange={handleChange}
            />
            <p className="text-xs text-muted-foreground">Platform fee applied to organizers on tours.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transporter_fee_percent">Transporter Fee (%)</Label>
            <Input
              id="transporter_fee_percent"
              type="number"
              name="transporter_fee_percent"
              step="0.1"
              min="0"
              max="50"
              value={formData.transporter_fee_percent}
              onChange={handleChange}
            />
            <p className="text-xs text-muted-foreground">Platform fee applied to independent transporters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="escrow_holding_days">Escrow Holding Period (Days)</Label>
            <Input
              id="escrow_holding_days"
              type="number"
              name="escrow_holding_days"
              min="0"
              max="60"
              value={formData.escrow_holding_days}
              onChange={handleChange}
            />
            <p className="text-xs text-muted-foreground">Days after the trip ends before funds clear (disputes allowed until then).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_payout_amount">Minimum Payout (₱)</Label>
            <Input
              id="min_payout_amount"
              type="number"
              name="min_payout_amount"
              step="0.01"
              min="1"
              value={formData.min_payout_amount}
              onChange={handleChange}
            />
            <p className="text-xs text-muted-foreground">Smallest withdrawal a partner can request.</p>
          </div>
        </div>

        {errorMsg && (
          <Alert variant="lighterror">
            <AlertCircle />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert variant="lightsuccess">
            <CheckCircle2 />
            <AlertDescription>Settings updated successfully!</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save Settings
          </Button>
        </div>
      </form>
    </CardBox>
  );
}
