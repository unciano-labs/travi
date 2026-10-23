import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { PayoutsClient, type AdminPayout } from '@/components/admin/PayoutsClient';
import PageHeader from '@/components/ui/PageHeader';
import { maskAccountNumber } from '@/lib/finance-format';
import { formatPHP } from '@/lib/format';

type Embed<T> = T | T[] | null | undefined;
const one = <T,>(value: Embed<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

interface PartnerName { company_name: string | null; display_name: string | null }
interface PayoutRow {
  id: string;
  amount: number | string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  payout_method: { method?: string; account_name?: string; account_number?: string; bank_name?: string; account?: string } | null;
  approver: Embed<{ full_name: string | null }>;
  user_wallets: Embed<{
    user_profiles: Embed<{
      full_name: string | null;
      email: string | null;
      organizer_profiles: Embed<PartnerName>;
      transporter_profiles: Embed<PartnerName>;
    }>;
  }>;
}

export default async function AdminPayoutsPage() {
  const { user, profile } = await requireSession();
  await assertRole(user.id, 'admin');

  // Service role: admin console read, authorized above (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });

  const [{ data: payouts }, { data: settings }] = await Promise.all([
    admin
      .from('payout_requests')
      .select(`
        id, amount, status, admin_notes, created_at, updated_at, approved_at, approved_by, payout_method,
        approver:user_profiles!approved_by ( full_name ),
        user_wallets (
          user_profiles (
            full_name,
            email,
            organizer_profiles ( company_name, display_name ),
            transporter_profiles ( company_name, display_name )
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('platform_settings')
      .select('payout_dual_approval_threshold')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows: AdminPayout[] = ((payouts ?? []) as unknown as PayoutRow[]).map((p) => {
    const owner = one(one(p.user_wallets)?.user_profiles);
    const org = one(owner?.organizer_profiles);
    const trans = one(owner?.transporter_profiles);
    const businessName = org?.company_name || trans?.company_name || org?.display_name || trans?.display_name || null;
    const method = p.payout_method ?? {};
    return {
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      adminNotes: p.admin_notes,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      approvedAt: p.approved_at,
      approvedBy: p.approved_by,
      approverName: one(p.approver)?.full_name ?? null,
      partnerName: businessName || owner?.full_name || 'Unknown',
      partnerPerson: businessName && owner?.full_name && businessName !== owner.full_name ? owner.full_name : null,
      partnerEmail: owner?.email ?? null,
      method: method.method ?? null,
      bankName: method.bank_name ?? null,
      accountName: method.account_name ?? null,
      accountMasked: maskAccountNumber(method.account_number ?? method.account ?? null),
    };
  });

  const threshold = settings?.payout_dual_approval_threshold;

  return (
    <>
      <PageHeader
        title="Payout Requests"
        description={
          threshold == null
            ? 'Manage and process partner withdrawals.'
            : `Payouts of ${formatPHP(threshold)} or more need approval by one admin and payment by another.`
        }
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Payouts' }]}
      />

      <PayoutsClient
        initialPayouts={rows}
        currentAdminId={profile.id as string}
        dualApprovalThreshold={threshold == null ? null : Number(threshold)}
      />
    </>
  );
}
