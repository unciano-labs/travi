'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, FileText, Loader2, Trash2 } from 'lucide-react';
import { submitPartnerDocuments, withdrawPartnerDocument } from '@/actions/partner-documents';
import ConfirmModal from '@/components/ui/ConfirmModal';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PartnerDocumentUpload from './PartnerDocumentUpload';
import { formatDateOfInstant } from '@/lib/format';
import {
  PARTNER_DOC_LABELS,
  type PartnerDocType,
  type PartnerDocumentInput,
  type PartnerType,
} from '@/lib/schemas/partner';

export interface OwnPartnerDocument {
  id: string;
  doc_type: string;
  vehicle_id: string | null;
  file_name: string | null;
  status: string;
  created_at: string;
}

const UPLOADABLE: Record<PartnerType, PartnerDocType[]> = {
  organizer: ['government_id', 'business_registration', 'bir_registration', 'dot_accreditation', 'other'],
  transporter: ['government_id', 'business_registration', 'bir_registration', 'ltfrb_franchise', 'insurance', 'other'],
};

const STATUS_LABEL: Record<string, string> = { submitted: 'In review', verified: 'Verified', rejected: 'Rejected' };
const STATUS_BADGE: Record<string, string> = { submitted: 'pending', verified: 'approved', rejected: 'rejected' };

/** KYC documents on the partner profile page: list, add more, withdraw (LEG-06/09). */
export default function PartnerDocumentsManager({ partner, documents }: { partner: PartnerType; documents: OwnPartnerDocument[] }) {
  const router = useRouter();
  const [docType, setDocType] = useState<PartnerDocType>(UPLOADABLE[partner][0]);
  const [pending, setPending] = useState<PartnerDocumentInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);

  async function submit() {
    if (!pending) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await submitPartnerDocuments({ partnerType: partner, documents: [pending] });
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setPending(null);
    setSuccess('Document submitted for review.');
    router.refresh();
  }

  async function withdraw(id: string) {
    setWithdrawId(null);
    setError(null);
    const res = await withdrawPartnerDocument(id);
    if (!res.success) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <h5 className="card-title">Verification documents</h5>
        <p className="text-sm text-muted-foreground">Private to you and the Travi review team.</p>
      </div>

      {error && (
        <Alert variant="lighterror">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="lightsuccess">
          <CheckCircle2 />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents submitted yet" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {PARTNER_DOC_LABELS[d.doc_type as PartnerDocType] ?? d.doc_type}
                  {d.vehicle_id ? ' (vehicle)' : ''}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.file_name || 'Document'} · {formatDateOfInstant(d.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={STATUS_BADGE[d.status] ?? d.status} label={STATUS_LABEL[d.status] ?? d.status} />
                {d.status !== 'verified' && (
                  <Button
                    type="button"
                    variant="ghosterror"
                    size="iconsm"
                    onClick={() => setWithdrawId(d.id)}
                    aria-label={`Remove ${PARTNER_DOC_LABELS[d.doc_type as PartnerDocType] ?? 'document'}`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-dashed border-border p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${partner}-doc-type`}>Add a document</Label>
          <NativeSelect
            id={`${partner}-doc-type`}
            value={docType}
            onChange={(e) => {
              setDocType(e.target.value as PartnerDocType);
              setPending(null);
            }}
          >
            {UPLOADABLE[partner].map((t) => (
              <option key={t} value={t}>{PARTNER_DOC_LABELS[t]}</option>
            ))}
          </NativeSelect>
        </div>
        <PartnerDocumentUpload
          key={docType}
          docType={docType}
          label="File"
          required
          value={pending}
          onChange={setPending}
          onError={setError}
        />
        <div className="flex justify-end md:col-span-2">
          <Button type="button" onClick={submit} disabled={!pending || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Submit document
          </Button>
        </div>
      </div>

      <ConfirmModal
        isOpen={withdrawId !== null}
        title="Remove document?"
        message="The review team will no longer see this document."
        confirmText="Remove"
        isDestructive
        onConfirm={() => withdrawId && withdraw(withdrawId)}
        onCancel={() => setWithdrawId(null)}
      />
    </div>
  );
}
