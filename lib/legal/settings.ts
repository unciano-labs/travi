// Platform values quoted in the policy pages (fee %, escrow holding days, payout minimum), read from
// the single platform_settings row so the policy text always matches the configuration.
// Public, cached read (anon client; platform_settings is publicly readable).
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { captureException } from '@/lib/logger';

export interface PolicySettings {
  organizerFeePercent: number;
  transporterFeePercent: number;
  escrowHoldingDays: number;
  minPayoutAmount: number;
  /** false when the values below are the defaults because the settings could not be read. */
  fromDatabase: boolean;
}

// DB defaults (AGENTS.md §4.4). Used only when the row cannot be read.
export const DEFAULT_POLICY_SETTINGS: PolicySettings = {
  organizerFeePercent: 10,
  transporterFeePercent: 3,
  escrowHoldingDays: 3,
  minPayoutAmount: 100,
  fromDatabase: false,
};

// A stored 0 is valid: never use `||` here (AGENTS.md §4.4).
function numberOr(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

export const getPolicySettings = unstable_cache(
  async (): Promise<PolicySettings> => {
    try {
      const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      // select('*'): min_payout_amount only exists once 20261023120000 is applied.
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_POLICY_SETTINGS;
      const row = data as Record<string, unknown>;
      return {
        organizerFeePercent: numberOr(row.organizer_fee_percent, DEFAULT_POLICY_SETTINGS.organizerFeePercent),
        transporterFeePercent: numberOr(row.transporter_fee_percent, DEFAULT_POLICY_SETTINGS.transporterFeePercent),
        escrowHoldingDays: numberOr(row.escrow_holding_days, DEFAULT_POLICY_SETTINGS.escrowHoldingDays),
        minPayoutAmount: numberOr(row.min_payout_amount, DEFAULT_POLICY_SETTINGS.minPayoutAmount),
        fromDatabase: true,
      };
    } catch (error: unknown) {
      captureException(error, { action: 'getPolicySettings' });
      return DEFAULT_POLICY_SETTINGS;
    }
  },
  ['legal-policy-settings'],
  // updatePlatformSettings (actions/admin.ts) invalidates the tag; the hour is a backstop.
  { tags: ['platform-settings'], revalidate: 3600 }
);

export function formatPercent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

export function formatPesoAmount(value: number): string {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDays(value: number): string {
  return `${value} day${value === 1 ? '' : 's'}`;
}
